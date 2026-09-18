"use client";

import React from "react";
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
  ChevronRight,
  Eye,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  Scale,
  Milk,
} from "lucide-react";
import {
  DataTab,
  LivestockRecord,
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
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-200/80 shadow-xs">
        <div className="bg-slate-50 inline-block p-4 rounded-full mb-3 border border-slate-100">
          <Search className="w-8 h-8 text-slate-300" />
        </div>
        <h4 className="text-base font-bold text-slate-800">No records found</h4>
        <p className="text-slate-500 font-medium text-xs mt-1 max-w-sm mx-auto">
          No records in {activeTab} matched your active search query or filter criteria.
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
    <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 border-b border-slate-200/70 hover:bg-slate-50/70">
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
            {items.map((item: any) => (
              <TableRow
                key={item.id}
                className="group hover:bg-slate-50/90 transition-colors cursor-pointer"
                onClick={() => onSelectRecord(item, activeTab)}
              >
                {/* ID */}
                <TableCell className="px-3.5 py-2 font-mono text-xs font-bold text-slate-900">
                  {item.id}
                </TableCell>

                {/* Farmer */}
                <TableCell className="px-3.5 py-2 font-bold text-slate-800 text-xs">
                  {item.farmerName || item.enumerator || "MAO Registry"}
                </TableCell>

                {/* Barangay */}
                <TableCell className="px-3.5 py-2">
                  <div className="flex items-center gap-1.5 text-slate-600 text-xs font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-[#2D5A27] shrink-0" />
                    <span>{item.barangay}</span>
                  </div>
                </TableCell>

                {/* ── Livestock Custom Columns ── */}
                {activeTab === "livestock" && (
                  <>
                    <TableCell className="px-3.5 py-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-blue-700 font-mono">
                          {item.cattleId}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.specie}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-3.5 py-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">
                          {item.breed}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.sex}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-3.5 py-2">
                      <Badge
                        className={`text-[9px] font-black uppercase px-2 py-0.2 border-0 ${
                          item.entryType === "BATCH"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.entryType || "INDIVIDUAL"} ({item.quantity || 1})
                      </Badge>
                    </TableCell>

                    <TableCell className="px-3.5 py-2 font-black text-xs text-slate-800">
                      {item.weightKg ? `${item.weightKg} kg` : "—"}
                    </TableCell>

                    <TableCell className="px-3.5 py-2 text-xs font-medium text-slate-600">
                      {item.lastVaccinationDate || "No record"}
                    </TableCell>

                    <TableCell className="px-3.5 py-2">
                      <Badge
                        className={`text-[9px] font-black uppercase px-2 py-0.2 border-0 ${
                          item.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status || "PENDING"}
                      </Badge>
                    </TableCell>
                  </>
                )}

                {/* ── Production Custom Columns ── */}
                {activeTab === "production" && (
                  <>
                    <TableCell className="px-3.5 py-2 font-bold text-xs text-slate-800">
                      {item.type}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-black text-xs text-[#2D5A27]">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="px-3.5 py-2">
                      <div className="flex flex-col text-[11px]">
                        <span className="font-bold text-slate-700">{item.qualityGrade}</span>
                        <span className="text-slate-400 text-[10px]">{item.collectionCenter}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-black text-xs text-slate-900">
                      ₱{item.estValuePhp?.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs font-medium text-slate-500">
                      {item.date}
                    </TableCell>
                  </>
                )}

                {/* ── Sales Custom Columns ── */}
                {activeTab === "sales" && (
                  <>
                    <TableCell className="px-3.5 py-2 font-bold text-xs text-slate-800">
                      {item.buyer}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs text-slate-600 font-medium">
                      {item.product}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-black text-xs text-emerald-700">
                      {item.amount}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-mono text-[11px] text-slate-600 font-bold">
                      {item.transportPermitNumber}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs font-medium text-slate-500">
                      {item.date}
                    </TableCell>
                  </>
                )}

                {/* ── Disease Custom Columns ── */}
                {activeTab === "disease" && (
                  <>
                    <TableCell className="px-3.5 py-2 font-mono text-xs font-black text-blue-700">
                      {item.cattleId}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-bold text-xs text-rose-700">
                      {item.disease}
                    </TableCell>
                    <TableCell className="px-3.5 py-2">
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
                    <TableCell className="px-3.5 py-2 text-xs text-slate-600 font-medium">
                      {item.veterinarian}
                    </TableCell>
                    <TableCell className="px-3.5 py-2">
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
                    <TableCell className="px-3.5 py-2 font-mono text-xs font-black text-slate-700">
                      {item.cattleId}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs font-bold text-slate-800">
                      {item.cause}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs text-slate-600">
                      {item.disposalMethod}
                    </TableCell>
                    <TableCell className="px-3.5 py-2">
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
                    <TableCell className="px-3.5 py-2 text-xs font-medium text-slate-500">
                      {item.dateOfDeath}
                    </TableCell>
                  </>
                )}

                {/* ── Slaughter Custom Columns ── */}
                {activeTab === "slaughter" && (
                  <>
                    <TableCell className="px-3.5 py-2 font-mono text-xs font-black text-slate-700">
                      {item.cattleId}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-black text-xs text-amber-800">
                      {item.carcassWeightKg} kg
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-mono text-xs text-slate-600 font-bold">
                      {item.inspectionCertNo}
                    </TableCell>
                    <TableCell className="px-3.5 py-2">
                      <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[9px] font-black uppercase px-1.5 py-0.2">
                        {item.postMortemStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs text-slate-600 font-medium">
                      {item.destinationMarket}
                    </TableCell>
                  </>
                )}

                {/* ── Census Custom Columns ── */}
                {activeTab === "census" && (
                  <>
                    <TableCell className="px-3.5 py-2 font-bold text-xs text-slate-900">
                      {item.quarter} {item.year}
                    </TableCell>
                    <TableCell className="px-3.5 py-2 font-black text-xs text-emerald-800">
                      {item.totalHeads?.toLocaleString()} heads
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs text-slate-600 font-medium">
                      {item.enumerator}
                    </TableCell>
                    <TableCell className="px-3.5 py-2">
                      <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[9px] font-black uppercase px-1.5 py-0.2">
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs font-medium text-slate-500">
                      {item.submissionDate}
                    </TableCell>
                  </>
                )}

                {/* Right Action */}
                <TableCell className="px-3.5 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 rounded-md text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRecord(item, activeTab);
                    }}
                  >
                    <Eye className="w-3 h-3" />
                    <span>View</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
