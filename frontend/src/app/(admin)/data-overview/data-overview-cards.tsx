"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Calendar,
  Eye,
  Milk,
  TrendingUp,
  AlertTriangle,
  Skull,
  Scale,
  FileSpreadsheet,
  Boxes,
  Search,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import { DataTab } from "./data-overview-types";

interface DataOverviewCardsProps {
  activeTab: DataTab;
  items: any[];
  onSelectRecord: (record: any, domain: DataTab) => void;
}

export function DataOverviewCards({
  activeTab,
  items,
  onSelectRecord,
}: DataOverviewCardsProps) {
  // Pagination State for Cards Grid
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeCurrentPage, pageSize]);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-2xs">
        <div className="bg-slate-50 inline-block p-4 rounded-full mb-3 border border-slate-100">
          <Search className="w-8 h-8 text-slate-300" />
        </div>
        <h4 className="text-base font-bold text-slate-800">No records found</h4>
        <p className="text-slate-500 font-medium text-xs mt-1 max-w-sm mx-auto">
          No records in <span className="font-bold text-slate-700">{activeTab}</span> currently recorded in the system.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {paginatedItems.map((item: any) => (
          <Card
            key={item.id}
            onClick={() => onSelectRecord(item, activeTab)}
            className="group rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-md transition-all hover:border-[#2D5A27]/50 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              {/* Card Header: Tag & ID */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-100 text-[#2D5A27] shrink-0 group-hover:bg-emerald-50 transition-colors">
                    {activeTab === "livestock" && <Icon iconNode={cowHead} className="size-4" />}
                    {activeTab === "batches" && <Boxes className="size-4 text-[#2D5A27]" />}
                    {activeTab === "production" && <Milk className="size-4 text-sky-700" />}
                    {activeTab === "sales" && <TrendingUp className="size-4 text-emerald-700" />}
                    {activeTab === "disease" && <AlertTriangle className="size-4 text-rose-700" />}
                    {activeTab === "mortality" && <Skull className="size-4 text-slate-700" />}
                    {activeTab === "slaughter" && <Scale className="size-4 text-amber-700" />}
                    {activeTab === "census" && <FileSpreadsheet className="size-4 text-indigo-700" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-bold text-slate-400">
                      {item.batchCode || item.id}
                    </p>
                    <p className="text-xs font-black text-slate-900 font-mono truncate max-w-[130px]">
                      {item.batchName || item.cattleId || item.quarter || item.specie || "Batch"}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <Badge
                  className={`text-[9px] font-black uppercase px-2 py-0.5 border-0 ${
                    item.healthStatus === "Healthy" ||
                    item.status === "Certified" ||
                    item.status === "Completed" ||
                    item.status === "APPROVED" ||
                    item.status === "MAO Verified"
                      ? "bg-emerald-100 text-emerald-800"
                      : item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION"
                      ? "bg-rose-100 text-rose-800 border border-rose-200"
                      : item.status === "Quarantined" || item.severity === "Critical"
                      ? "bg-rose-600 text-white"
                      : item.status === "VERIFIED"
                      ? "bg-sky-100 text-sky-800"
                      : item.status === "PENDING" || item.status === "Pending Review"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION"
                    ? "Revision Required"
                    : item.status === "VERIFIED" ? "SIBAT Verified"
                    : item.status === "APPROVED" ? "MAO Approved"
                    : item.status === "PENDING" || item.status === "Pending Review" ? "Awaiting SIBAT"
                    : item.healthStatus || item.status || item.qualityGrade || "Active"}
                </Badge>
              </div>

              {/* Farmer & Location Info */}
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {item.farmerName || item.buyer || item.enumerator || "Municipal Record"}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#2D5A27] shrink-0" />
                  <span>Brgy. {item.barangay}</span>
                </div>
              </div>

              {/* Middle Data Highlights */}
              <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-100 text-xs space-y-1.5">
                {activeTab === "livestock" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Breed / Specie:</span>
                      <strong className="text-slate-900">{item.breed} ({item.specie})</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Weight / Entry:</span>
                      <strong className="text-slate-900">
                        {item.weightKg ? `${item.weightKg} kg` : "—"} &bull; {item.entryType || "INDIVIDUAL"}
                      </strong>
                    </div>
                    {item.batchCode && (
                      <div className="flex justify-between text-slate-600">
                        <span>Cohort:</span>
                        <strong className="text-[#2D5A27] font-mono text-[11px] truncate max-w-[130px]" title={item.batchName || item.batchCode}>
                          {item.batchName || item.batchCode}
                        </strong>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Last Vaccination:</span>
                      <strong className="text-slate-900">{item.lastVaccinationDate || "None"}</strong>
                    </div>
                  </>
                )}

                {activeTab === "batches" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Specie & Heads:</span>
                      <strong className="text-slate-900">
                        {item.specie} &bull; {item.totalAnimals || 0} Heads
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Housing Pen:</span>
                      <strong className="text-slate-900 truncate max-w-[130px]">
                        {item.housingPen || "General Pen"}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Avg Weight:</span>
                      <strong className="text-slate-900">
                        {item.averageWeight ? `${item.averageWeight} kg` : "—"}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Feed:</span>
                      <strong className="text-slate-900 truncate max-w-[130px]">
                        {item.feedType || "—"}
                      </strong>
                    </div>
                  </>
                )}

                {activeTab === "production" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Yield:</span>
                      <strong className="text-[#2D5A27] font-black">{item.quantity}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Est. Value:</span>
                      <strong className="text-slate-900">₱{item.estValuePhp?.toLocaleString()}</strong>
                    </div>
                  </>
                )}

                {activeTab === "sales" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Product:</span>
                      <strong className="text-slate-900">{item.product}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Amount:</span>
                      <strong className="text-emerald-700 font-black">{item.amount}</strong>
                    </div>
                  </>
                )}

                {activeTab === "disease" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Condition:</span>
                      <strong className="text-rose-700 font-bold truncate max-w-[120px]">{item.disease}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Affected:</span>
                      <strong className="text-slate-900">{item.affectedHeads} heads</strong>
                    </div>
                  </>
                )}

                {activeTab === "mortality" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Cause:</span>
                      <strong className="text-slate-900 truncate max-w-[130px]">{item.cause}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Insurance:</span>
                      <strong className="text-slate-900">{item.insuranceClaimStatus}</strong>
                    </div>
                  </>
                )}

                {activeTab === "slaughter" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Carcass Wt:</span>
                      <strong className="text-amber-800 font-black">{item.carcassWeightKg} kg</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Cert No:</span>
                      <strong className="text-slate-900 font-mono">{item.inspectionCertNo}</strong>
                    </div>
                  </>
                )}

                {activeTab === "census" && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Heads:</span>
                      <strong className="text-emerald-800 font-black">{item.totalHeads?.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Cattle Count:</span>
                      <strong className="text-slate-900">{item.cattleCount}</strong>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom: Date & Inspect Action */}
              <div className="flex items-center justify-between pt-1.5 text-[11px] text-slate-400 font-medium">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{item.date || item.createdAt || item.registrationDate || item.submissionDate || "2026"}</span>
                </div>

                <span className="text-[#2D5A27] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Inspect <Eye className="w-3.5 h-3.5" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controls */}
      <ValidationPagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[12, 24, 48]}
      />
    </div>
  );
}
