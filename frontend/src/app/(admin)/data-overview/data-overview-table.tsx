"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Search,
  Eye,
  Boxes,
  ExternalLink,
} from "lucide-react";
import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import {
  DataTab,
  LivestockRecord,
  BatchRecord,
  ProductionRecord,
  SalesRecord,
  DiseaseRecord,
  MortalityRecord,
  SlaughterRecord,
  CensusRecord,
} from "./data-overview-types";

interface DataOverviewTableProps {
  activeTab: DataTab;
  items: any[];
  onSelectRecord: (record: any, domain: DataTab) => void;
  onResetFilters: () => void;
}

export function DataOverviewTable({
  activeTab,
  items,
  onSelectRecord,
  onResetFilters,
}: DataOverviewTableProps) {
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to first page when tab changes
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
          No records in <span className="font-bold text-slate-700">{activeTab}</span> matched your active search query or filter criteria.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onResetFilters}
          className="mt-4 rounded-xl text-xs font-bold border-slate-300"
        >
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/90 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-b border-slate-200/80 hover:bg-slate-50/80">
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  ID / Code
                </TableHead>
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  {activeTab === "sales" ? "Seller / Farmer" : "Farmer / Raiser"}
                </TableHead>
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Barangay Sector
                </TableHead>

                {/* ── Livestock Columns ── */}
                {activeTab === "livestock" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Animal Tag & Specie
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Breed & Sex
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Entry Type & Qty
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Weight (kg)
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Last Vaccination
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Status
                    </TableHead>
                  </>
                )}

                {/* ── Batches & Pens Columns ── */}
                {activeTab === "batches" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Batch Name & Housing Pen
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Specie & Cohort Size
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Feed Program
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Avg / Target Weight
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Target Harvest
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Review Status
                    </TableHead>
                  </>
                )}

                {/* ── Production Columns ── */}
                {activeTab === "production" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Yield Type
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Quantity
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Grade / Center
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Est. Value
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Date
                    </TableHead>
                  </>
                )}

                {/* ── Sales & Auction Columns ── */}
                {activeTab === "sales" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Buyer / Entity
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Commodity
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Hammer Price
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Permit #
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Date
                    </TableHead>
                  </>
                )}

                {/* ── Disease Surveillance Columns ── */}
                {activeTab === "disease" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Animal Tag
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Suspected Disease
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Severity / Heads
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Attending Vet
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Status
                    </TableHead>
                  </>
                )}

                {/* ── Mortality Columns ── */}
                {activeTab === "mortality" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Animal Tag
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Cause of Death
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Disposal Method
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Insurance
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Date
                    </TableHead>
                  </>
                )}

                {/* ── Slaughter Columns ── */}
                {activeTab === "slaughter" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Animal Tag
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Carcass Weight
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Meat Cert No.
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Post-Mortem
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Market
                    </TableHead>
                  </>
                )}

                {/* ── Census Columns ── */}
                {activeTab === "census" && (
                  <>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Quarter / Year
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Total Surveyed
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Enumerator
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Verification
                    </TableHead>
                    <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Date
                    </TableHead>
                  </>
                )}

                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-slate-100">
              {paginatedItems.map((item: any) => (
                <TableRow
                  key={item.id}
                  className="group hover:bg-slate-50/90 transition-colors cursor-pointer"
                  onClick={() => onSelectRecord(item, activeTab)}
                >
                  {/* ID / Code */}
                  <TableCell className="px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900">
                    {item.batchCode || item.id}
                  </TableCell>

                  {/* Farmer / Raiser */}
                  <TableCell className="px-3.5 py-2.5 font-bold text-slate-800 text-xs">
                    {item.farmerName || item.enumerator || "MAO Registry"}
                  </TableCell>

                  {/* Barangay */}
                  <TableCell className="px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 text-slate-600 text-xs font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-[#2D5A27] shrink-0" />
                      <span>{item.barangay}</span>
                    </div>
                  </TableCell>

                  {/* ── Livestock Custom Columns ── */}
                  {activeTab === "livestock" && (
                    <>
                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-blue-700 font-mono">
                            {item.cattleId}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.specie}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">
                            {item.breed}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.sex}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            className={`text-[9px] font-black uppercase px-2 py-0.2 border-0 w-max ${
                              item.entryType === "BATCH" || item.batchCode
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {item.batchCode ? "COHORT" : item.entryType || "INDIVIDUAL"} ({item.quantity || 1})
                          </Badge>
                          {item.batchCode && (
                            <span
                              className="text-[10px] font-mono font-bold text-[#2D5A27] truncate max-w-[120px]"
                              title={item.batchName || item.batchCode}
                            >
                              {item.batchName || item.batchCode}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5 font-black text-xs text-slate-800">
                        {item.weightKg ? `${item.weightKg} kg` : "—"}
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5 text-xs font-medium text-slate-600">
                        {item.lastVaccinationDate || "No record"}
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5">
                        <Badge
                          className={`text-[9px] font-black uppercase px-2 py-0.5 border-0 ${
                            item.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "VERIFIED"
                              ? "bg-sky-100 text-sky-800 border border-sky-200"
                              : item.status === "REJECTED" || item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status === "REJECTED" || item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION"
                            ? "Revision Required"
                            : item.status === "VERIFIED" ? "SIBAT Verified"
                            : item.status === "APPROVED" ? "MAO Approved" : "Awaiting SIBAT"}
                        </Badge>
                      </TableCell>
                    </>
                  )}

                  {/* ── Batches Custom Columns ── */}
                  {activeTab === "batches" && (
                    <>
                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-[#2D5A27] shrink-0" />
                            {item.batchName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.housingPen || "General Pen"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-black px-2 py-0.5">
                            {item.totalAnimals || 0} Heads
                          </Badge>
                          <span className="text-xs font-semibold text-slate-700">
                            {item.specie}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5 text-xs font-medium text-slate-600">
                        {item.feedType || "—"}
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex flex-col text-xs font-semibold">
                          <span className="text-slate-900 font-bold">
                            {item.averageWeight ? `${item.averageWeight} kg avg` : "—"}
                          </span>
                          {item.targetWeight && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              Target: {item.targetWeight} kg
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5 text-xs font-medium text-slate-600">
                        {item.targetHarvestDate || "—"}
                      </TableCell>

                      <TableCell className="px-3.5 py-2.5">
                        <Badge
                          className={`text-[9px] font-black uppercase px-2 py-0.5 border-0 ${
                            item.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : item.status === "VERIFIED"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION"
                            ? "Revision Required"
                            : item.status === "VERIFIED" ? "SIBAT Verified"
                            : item.status === "APPROVED" ? "MAO Approved" : "Awaiting SIBAT"}
                        </Badge>
                      </TableCell>
                    </>
                  )}

                  {/* ── Production Custom Columns ── */}
                  {activeTab === "production" && (
                    <>
                      <TableCell className="px-3.5 py-2.5 font-bold text-xs text-slate-800">
                        {item.type}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-black text-xs text-[#2D5A27]">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex flex-col text-[11px]">
                          <span className="font-bold text-slate-700">{item.qualityGrade}</span>
                          <span className="text-slate-400 text-[10px]">{item.collectionCenter}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-black text-xs text-slate-900">
                        ₱{item.estValuePhp?.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs font-medium text-slate-500">
                        {item.date}
                      </TableCell>
                    </>
                  )}

                  {/* ── Sales Custom Columns ── */}
                  {activeTab === "sales" && (
                    <>
                      <TableCell className="px-3.5 py-2.5 font-bold text-xs text-slate-800">
                        {item.buyer}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs text-slate-600 font-medium">
                        {item.product}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-black text-xs text-emerald-700">
                        {item.amount}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600 font-bold">
                        {item.transportPermitNumber}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs font-medium text-slate-500">
                        {item.date}
                      </TableCell>
                    </>
                  )}

                  {/* ── Disease Custom Columns ── */}
                  {activeTab === "disease" && (
                    <>
                      <TableCell className="px-3.5 py-2.5 font-mono text-xs font-black text-blue-700">
                        {item.cattleId}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-bold text-xs text-rose-700">
                        {item.disease}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={`text-[9px] font-black uppercase px-1.5 py-0.2 border-0 ${
                              item.severity === "Critical"
                                ? "bg-rose-100 text-rose-800"
                                : item.severity === "Moderate"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {item.severity}
                          </Badge>
                          <span className="text-xs font-bold text-slate-700">
                            {item.affectedHeads} heads
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs text-slate-600 font-medium">
                        {item.veterinarian}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <Badge
                          className={`text-[9px] font-black uppercase px-2 py-0.2 border-0 ${
                            item.status === "Quarantined"
                              ? "bg-rose-600 text-white"
                              : item.status === "Recovered"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                    </>
                  )}

                  {/* ── Mortality Custom Columns ── */}
                  {activeTab === "mortality" && (
                    <>
                      <TableCell className="px-3.5 py-2.5 font-mono text-xs font-black text-slate-700">
                        {item.cattleId}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs font-bold text-slate-800">
                        {item.cause}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs text-slate-600">
                        {item.disposalMethod}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <Badge
                          className={`text-[9px] font-black uppercase px-1.5 py-0.2 border-0 ${
                            item.insuranceClaimStatus === "Approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.insuranceClaimStatus === "In Review"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.insuranceClaimStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs font-medium text-slate-500">
                        {item.dateOfDeath}
                      </TableCell>
                    </>
                  )}

                  {/* ── Slaughter Custom Columns ── */}
                  {activeTab === "slaughter" && (
                    <>
                      <TableCell className="px-3.5 py-2.5 font-mono text-xs font-black text-slate-700">
                        {item.cattleId}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-black text-xs text-amber-800">
                        {item.carcassWeightKg} kg
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-mono text-xs text-slate-600 font-bold">
                        {item.inspectionCertNo}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[9px] font-black uppercase px-1.5 py-0.2">
                          {item.postMortemStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs text-slate-600 font-medium">
                        {item.destinationMarket}
                      </TableCell>
                    </>
                  )}

                  {/* ── Census Custom Columns ── */}
                  {activeTab === "census" && (
                    <>
                      <TableCell className="px-3.5 py-2.5 font-bold text-xs text-slate-900">
                        {item.quarter} {item.year}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 font-black text-xs text-emerald-800">
                        {item.totalHeads?.toLocaleString()} heads
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs text-slate-600 font-medium">
                        {item.enumerator}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[9px] font-black uppercase px-1.5 py-0.2">
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-xs font-medium text-slate-500">
                        {item.submissionDate}
                      </TableCell>
                    </>
                  )}

                  {/* Right Action */}
                  <TableCell className="px-3.5 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7.5 px-2.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecord(item, activeTab);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 text-[#2D5A27]" />
                        <span>Inspect</span>
                      </Button>

                      {activeTab === "batches" && (
                        <Link
                          href={`/data-validation/batches?batchId=${encodeURIComponent(
                            item.rawId ||
                              (typeof item.id === "number" ? item.id : String(item.id).replace(/\D/g, "")) ||
                              item.batchCode ||
                              item.id
                          )}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#2D5A27] hover:bg-emerald-50 transition-colors"
                          title="Drilldown into Pens and Individual Animals"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      <ValidationPagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50]}
      />
    </div>
  );
}
