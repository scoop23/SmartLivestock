"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
      {items.map((item: any) => (
        <Card
          key={item.id}
          onClick={() => onSelectRecord(item, activeTab)}
          className="rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all hover:border-[#2D5A27]/40 cursor-pointer overflow-hidden flex flex-col justify-between"
        >
          <CardContent className="p-3 sm:p-3.5 space-y-2.5">
            {/* Card Header: Tag & ID */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-slate-100 text-[#2D5A27] shrink-0">
                  {activeTab === "livestock" && <Icon iconNode={cowHead} className="size-4" />}
                  {activeTab === "production" && <Milk className="size-4 text-sky-700" />}
                  {activeTab === "sales" && <TrendingUp className="size-4 text-emerald-700" />}
                  {activeTab === "disease" && <AlertTriangle className="size-4 text-rose-700" />}
                  {activeTab === "mortality" && <Skull className="size-4 text-slate-700" />}
                  {activeTab === "slaughter" && <Scale className="size-4 text-amber-700" />}
                  {activeTab === "census" && <FileSpreadsheet className="size-4 text-purple-700" />}
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-slate-400">
                    {item.id}
                  </p>
                  <p className="text-xs font-black text-slate-900 font-mono">
                    {item.cattleId || item.quarter || item.specie || "Batch"}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <Badge
                className={`text-[9px] font-black uppercase px-2 py-0.5 border-0 ${
                  item.healthStatus === "Healthy" ||
                  item.status === "Certified" ||
                  item.status === "Completed" ||
                  item.status === "MAO Verified"
                    ? "bg-emerald-100 text-emerald-800"
                    : item.status === "Quarantined" || item.severity === "Critical"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.healthStatus || item.status || item.qualityGrade || "Active"}
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
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
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
                  <div className="flex justify-between text-slate-600">
                    <span>Last Vaccination:</span>
                    <strong className="text-slate-900">{item.lastVaccinationDate || "None"}</strong>
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

            {/* Bottom: Date & View Button */}
            <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400 font-medium">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{item.date || item.registrationDate || item.submissionDate || "2026"}</span>
              </div>

              <span className="text-[#2D5A27] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Inspect <Eye className="w-3.5 h-3.5" />
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
