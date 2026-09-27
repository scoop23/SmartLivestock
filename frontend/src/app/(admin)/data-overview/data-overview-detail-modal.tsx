"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  User,
  Phone,
  Tag,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Copy,
  Boxes,
  ExternalLink,
  QrCode,
  Scale,
  Milk,
  FileSpreadsheet,
  Activity,
  Check,
  Building2,
  Clock,
  Info,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import { toast } from "sonner";
import { DataTab } from "./data-overview-types";
import { QrCodePass } from "@/components/qr-code-pass";

interface DataOverviewDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: any | null;
  domain: DataTab;
}

export function DataOverviewDetailModal({
  open,
  onOpenChange,
  record,
  domain,
}: DataOverviewDetailModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "origin" | "qr" | "roster">("overview");
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const isBatch =
    domain === "batches" ||
    (domain !== "livestock" && (Boolean(record.totalAnimals !== undefined)));

  const targetBatchId =
    record.rawId ||
    (typeof record.id === "number" ? record.id : String(record.id).replace(/\D/g, "")) ||
    record.batchCode ||
    record.id;

  const identifierCode = isBatch
    ? (record.batchCode || record.id)
    : (record.cattleId || record.tagNumber || record.id);

  const handleCopyTag = () => {
    navigator.clipboard.writeText(identifierCode);
    setCopied(true);
    toast.success(`Copied "${identifierCode}" to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Status badge styling helper
  const renderStatusBadge = (statusStr: string | undefined) => {
    const s = String(statusStr || "PENDING").toUpperCase();
    if (s.includes("APPROV") || s.includes("VERIF") || s.includes("CERTIF") || s.includes("COMPLET")) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
          <CheckCircle2 className="size-3 mr-1 inline" />
          {statusStr}
        </Badge>
      );
    }
    if (s.includes("REVI") || s.includes("PEND") || s.includes("AUDIT")) {
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
          <Clock className="size-3 mr-1 inline" />
          {statusStr}
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
        <AlertTriangle className="size-3 mr-1 inline" />
        {statusStr}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl md:max-w-4xl rounded-2xl sm:rounded-3xl p-0 overflow-hidden border border-slate-200 shadow-2xl bg-white flex flex-col max-h-[92vh]">
        {/* ── Remastered Executive Hero Header ── */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#1E3D1A] to-slate-950 text-white p-4 sm:p-5 relative overflow-hidden shrink-0 border-b border-emerald-900/60">
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-emerald-600/10 to-transparent pointer-events-none" />

          {/* Top Domain & Verification Meta */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-200 border border-white/20 text-[9px] font-black uppercase tracking-widest">
                {domain.toUpperCase()} MASTER RECORD
              </span>
              <span className="text-[10px] text-emerald-300/80 font-mono hidden xs:inline">
                Padre Garcia MAO Traceability Core
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {renderStatusBadge(record.status || "APPROVED")}
            </div>
          </div>

          {/* Title & Primary Code */}
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 truncate">
                {isBatch ? (
                  <>
                    <Boxes className="w-6 h-6 text-emerald-400 shrink-0" />
                    <span className="truncate">{record.batchName || record.batchCode}</span>
                  </>
                ) : record.cattleId ? (
                  <>
                    <Icon iconNode={cowHead} className="size-5 text-emerald-400 shrink-0" />
                    <span className="truncate">{record.cattleId}</span>
                  </>
                ) : (
                  <span>{record.product || record.disease || record.quarter || record.id}</span>
                )}
              </DialogTitle>
            </div>

            <DialogDescription className="text-xs text-emerald-200/90 flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold bg-black/30 px-2 py-0.5 rounded text-emerald-300">
                {identifierCode}
              </span>
              <span>•</span>
              <span>Barangay <strong>{record.barangay}</strong></span>
              <span>•</span>
              <span>Owner: <strong>{record.farmerName || record.enumerator || record.buyer || "Registered Farmer"}</strong></span>
              {!isBatch && (record.batchCode || record.batchName) && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 font-bold text-[10px]">
                    <Boxes className="size-3 text-emerald-300" />
                    Cohort: {record.batchName || record.batchCode}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Sub-Tab Navigation Bar ── */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <Tabs
            value={activeSubTab}
            onValueChange={(val) => setActiveSubTab(val as any)}
            className="w-full"
          >
            <TabsList className="bg-slate-200/70 p-1.5 rounded-xl h-auto w-full sm:w-auto flex flex-wrap sm:flex-nowrap gap-1.5 border border-slate-300/60 shadow-2xs">
              <TabsTrigger
                value="overview"
                className="px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer data-[state=active]:bg-[#2D5A27] data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=active]:font-black text-slate-600 hover:text-slate-900 hover:bg-white/60"
              >
                <span className="text-sm">📋</span>
                <span>Specification</span>
              </TabsTrigger>
              <TabsTrigger
                value="origin"
                className="px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer data-[state=active]:bg-[#1E4D6B] data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=active]:font-black text-slate-600 hover:text-slate-900 hover:bg-white/60"
              >
                <span className="text-sm">🧑‍🌾</span>
                <span>Raiser & Origin</span>
              </TabsTrigger>
              <TabsTrigger
                value="qr"
                className="px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=active]:font-black text-slate-600 hover:text-slate-900 hover:bg-white/60"
              >
                <span className="text-sm">🛡️</span>
                <span>Digital QR Pass</span>
              </TabsTrigger>
              {isBatch && record.animals && record.animals.length > 0 && (
                <TabsTrigger
                  value="roster"
                  className="px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer data-[state=active]:bg-[#2D5A27] data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=active]:font-black text-slate-600 hover:text-slate-900 hover:bg-white/60"
                >
                  <span className="text-sm">🐄</span>
                  <span>Cohort Roster ({record.animals.length})</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        {/* ── Modal Content Body ── */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: OVERVIEW & SPECIFICATIONS */}
          {activeSubTab === "overview" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Batch & Cohort Membership Highlight for Individual Livestock */}
              {!isBatch && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-slate-50/80 to-emerald-50/40 border border-emerald-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                        <Boxes className="size-4.5 text-[#2D5A27]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                          <span>Batch &amp; Herd Cohort Membership</span>
                        </h4>
                        <p className="text-[11px] text-emerald-800/80 font-medium">
                          Official municipal grouping, housing pen, and collective feeding allocation
                        </p>
                      </div>
                    </div>

                    {record.batchCode || record.batchName ? (
                      <Badge className="bg-[#2D5A27] text-white border-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 shadow-2xs">
                        Assigned to Cohort
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white text-[10px] font-bold">
                        Independent Individual Head
                      </Badge>
                    )}
                  </div>

                  {record.batchCode || record.batchName ? (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-xl bg-white border border-emerald-100/90 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                            Cohort Code
                          </span>
                          <p className="text-xs font-mono font-black text-emerald-900 mt-0.5 truncate">
                            {record.batchCode || "N/A"}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100/90 shadow-2xs sm:col-span-2">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                            Cohort / Group Name
                          </span>
                          <p className="text-xs font-black text-slate-900 mt-0.5 truncate">
                            {record.batchName || `Batch ${record.batchCode}`}
                          </p>
                        </div>
                      </div>

                      {(record.housingPen || record.feedType) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {record.housingPen && (
                            <div className="p-2.5 rounded-xl bg-white/90 border border-emerald-100 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                                Assigned Housing Pen
                              </span>
                              <p className="text-xs font-bold text-slate-900 mt-0.5">
                                {record.housingPen}
                              </p>
                            </div>
                          )}
                          {record.feedType && (
                            <div className="p-2.5 rounded-xl bg-white/90 border border-emerald-100 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                                Feeding Regimen
                              </span>
                              <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                                {record.feedType}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">
                        Individual Animal Registration
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        This animal was registered as an independent head and is not part of an aggregated cohort or batch.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Specification Grid */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                  Technical Specifications & Metrics
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {isBatch && record.batchCode && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Batch Code</span>
                      <p className="text-xs font-mono font-black text-emerald-800 mt-0.5">
                        {record.batchCode}
                      </p>
                    </div>
                  )}

                  {!isBatch && record.batchCode && (
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
                      <span className="text-[10px] font-bold text-emerald-800 block uppercase">Assigned Cohort</span>
                      <p className="text-xs font-mono font-black text-emerald-950 mt-0.5 truncate">
                        {record.batchName || record.batchCode}
                      </p>
                    </div>
                  )}

                  {record.housingPen && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Housing Pen</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.housingPen}</p>
                    </div>
                  )}

                  {record.feedType && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Feed Program</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{record.feedType}</p>
                    </div>
                  )}

                  {record.specie && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Specie</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.specie}</p>
                    </div>
                  )}

                  {record.breed && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Breed</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.breed}</p>
                    </div>
                  )}

                  {record.totalAnimals !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Total Animals</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">
                        {record.totalAnimals} Heads
                      </p>
                    </div>
                  )}

                  {record.averageWeight !== undefined && record.averageWeight !== null && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Average Weight</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">
                        {record.averageWeight} kg
                      </p>
                    </div>
                  )}

                  {record.targetWeight !== undefined && record.targetWeight !== null && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Target Weight</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">
                        {record.targetWeight} kg
                      </p>
                    </div>
                  )}

                  {record.targetHarvestDate && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Target Harvest Date</span>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">
                        {record.targetHarvestDate}
                      </p>
                    </div>
                  )}

                  {record.sex && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Sex / Gender</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.sex}</p>
                    </div>
                  )}

                  {record.ageMonths !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Age</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.ageMonths} Months</p>
                    </div>
                  )}

                  {record.lastVaccinationDate && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Last Vaccination</span>
                      <p className="text-xs font-bold text-emerald-800 mt-0.5">{record.lastVaccinationDate}</p>
                    </div>
                  )}

                  {record.weightKg && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Live Weight</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.weightKg} kg</p>
                    </div>
                  )}

                  {record.quantity && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Quantity / Volume</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">{record.quantity}</p>
                    </div>
                  )}

                  {record.estValuePhp !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Est. Market Value</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">
                        ₱{record.estValuePhp.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {record.amount && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Trading Amount</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">{record.amount}</p>
                    </div>
                  )}

                  {record.transportPermitNumber && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Transport Permit</span>
                      <p className="text-xs font-mono font-black text-slate-800 mt-0.5">
                        {record.transportPermitNumber}
                      </p>
                    </div>
                  )}

                  {record.disease && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Condition Name</span>
                      <p className="text-xs font-black text-rose-700 mt-0.5">{record.disease}</p>
                    </div>
                  )}

                  {record.veterinarian && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Attending Vet</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.veterinarian}</p>
                    </div>
                  )}

                  {record.severity && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Severity Level</span>
                      <p className="text-xs font-black text-amber-700 mt-0.5">{record.severity}</p>
                    </div>
                  )}

                  {record.affectedHeads !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Affected Heads</span>
                      <p className="text-xs font-black text-rose-700 mt-0.5">{record.affectedHeads} Heads</p>
                    </div>
                  )}

                  {record.inspectionCertNo && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Inspection Cert No</span>
                      <p className="text-xs font-mono font-black text-emerald-800 mt-0.5">{record.inspectionCertNo}</p>
                    </div>
                  )}

                  {record.carcassWeightKg !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Carcass Weight</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.carcassWeightKg} kg</p>
                    </div>
                  )}

                  {record.anteMortemStatus && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Ante-Mortem Status</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">{record.anteMortemStatus}</p>
                    </div>
                  )}

                  {record.postMortemStatus && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Post-Mortem Status</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">{record.postMortemStatus}</p>
                    </div>
                  )}

                  {record.meatInspector && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Meat Inspector</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.meatInspector}</p>
                    </div>
                  )}

                  {record.destinationMarket && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Destination Market</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">{record.destinationMarket}</p>
                    </div>
                  )}

                  {record.purpose && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Intended Purpose</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.purpose}</p>
                    </div>
                  )}

                  {record.cause && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Mortality Cause</span>
                      <p className="text-xs font-black text-rose-700 mt-0.5">{record.cause}</p>
                    </div>
                  )}

                  {record.disposalMethod && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Disposal Method</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.disposalMethod}</p>
                    </div>
                  )}

                  {record.insuranceClaimStatus && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Insurance Claim</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.insuranceClaimStatus}</p>
                    </div>
                  )}

                  {record.buyer && !record.buyerContact && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Purchaser / Buyer</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.buyer}</p>
                    </div>
                  )}

                  {record.paymentMethod && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Payment Method</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.paymentMethod}</p>
                    </div>
                  )}

                  {record.qualityGrade && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Quality Grade</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">{record.qualityGrade}</p>
                    </div>
                  )}

                  {record.fatContentPercentage !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Butterfat Content</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.fatContentPercentage}%</p>
                    </div>
                  )}

                  {record.collectionCenter && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Collection Center</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{record.collectionCenter}</p>
                    </div>
                  )}

                  {record.quarter && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Census Period</span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">{record.quarter} {record.year}</p>
                    </div>
                  )}

                  {record.totalHeads !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 block">Total Enumerated Heads</span>
                      <p className="text-xs font-black text-emerald-800 mt-0.5">{record.totalHeads} Heads</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks / Symptoms Card */}
              {(record.notes || record.reviewRemarks || (record.symptoms && record.symptoms.length > 0)) && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <Info className="size-3.5 text-amber-600" />
                    <span>Official Inspection Remarks &amp; Clinical Symptoms:</span>
                  </div>

                  {record.symptoms && record.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {record.symptoms.map((sym: string) => (
                        <Badge key={sym} className="bg-amber-200/80 text-amber-950 border-0 text-[10px] font-bold">
                          {sym}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {record.reviewRemarks && (
                    <p className="text-amber-950 font-semibold italic">&ldquo;{record.reviewRemarks}&rdquo;</p>
                  )}
                  {record.notes && <p className="text-amber-900">{record.notes}</p>}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RAISER PROFILE & GEOGRAPHIC ORIGIN */}
          {activeSubTab === "origin" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Primary Raiser / Declarant
                  </span>
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm shrink-0">
                      <User className="size-5 text-[#2D5A27]" />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">
                        {record.farmerName || record.enumerator || record.buyer || "Registered Farmer"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        Verified MAO Raiser Registry
                      </p>
                      {record.farmerContact && (
                        <p className="text-xs text-slate-700 font-bold mt-1 flex items-center gap-1.5">
                          <Phone className="size-3 text-slate-400" />
                          {record.farmerContact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Territorial Origin
                  </span>
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-black text-sm shrink-0">
                      <MapPin className="size-5 text-sky-700" />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">
                        Brgy. {record.barangay}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        Municipality of Padre Garcia • Batangas
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Active Biosecurity Sector
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Audit Stamp */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck className="size-5 text-emerald-700 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">
                      Official Certified Municipal Ledger Record
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Certified on{" "}
                      <strong>
                        {record.date || record.createdAt || record.registrationDate || record.submissionDate || "2026-04-20"}
                      </strong>
                      {record.reviewedByName && (
                        <> by Officer <strong>{record.reviewedByName}</strong></>
                      )}
                    </p>
                  </div>
                </div>

                <Badge className="bg-emerald-700 text-white font-black text-[9px] uppercase px-2.5 py-1 self-start sm:self-auto shadow-2xs">
                  CERTIFIED AUTHENTIC
                </Badge>
              </div>
            </div>
          )}

          {/* TAB 3: DIGITAL QR CODE PASSPORT */}
          {activeSubTab === "qr" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200 flex flex-col items-center">
              <QrCodePass
                code={identifierCode}
                title={isBatch ? `Batch ${record.batchName || record.batchCode}` : `${record.specie || "Livestock"} Passport`}
                subtitle="Official Municipal Biosecurity & Traceability Digital Clearance"
                ownerName={record.farmerName || record.enumerator || "Registered Farmer"}
                barangay={record.barangay}
                specie={record.specie}
                headCount={record.totalAnimals || record.quantity}
                status={record.status || "APPROVED"}
                verifiedAt={record.reviewedAt || record.createdAt || record.date}
              />
            </div>
          )}

          {/* TAB 4: COHORT ROSTER (BATCHES ONLY) */}
          {activeSubTab === "roster" && isBatch && (
            <div className="space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    Cohort Individual Animals Roster
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    All tagged animals officially registered within this housing pen
                  </p>
                </div>

                <Link
                  href={`/data-validation/batches?batchId=${encodeURIComponent(targetBatchId)}`}
                  className="text-xs font-bold text-[#2D5A27] hover:underline flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                >
                  Manage Roster in Validation Center <ExternalLink className="size-3" />
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs shadow-2xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100/90 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Tag Number</th>
                      <th className="p-2.5">Breed</th>
                      <th className="p-2.5">Sex</th>
                      <th className="p-2.5">Live Weight</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {record.animals?.map((animal: any) => (
                      <tr key={animal.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-mono font-bold text-emerald-950 flex items-center gap-1.5">
                          <Tag className="size-3 text-emerald-600" />
                          {animal.tag_number || animal.tagNumber || `ID-${animal.id}`}
                        </td>
                        <td className="p-2.5 text-slate-700">{animal.breed || "Standard"}</td>
                        <td className="p-2.5 text-slate-700">{animal.sex || "—"}</td>
                        <td className="p-2.5 font-semibold text-slate-900">
                          {animal.weight ? `${animal.weight} kg` : "—"}
                        </td>
                        <td className="p-2.5 text-right">
                          <Badge className="text-[9px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-900 border-0">
                            {animal.status || "APPROVED"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Remastered Footer Action Bar ── */}
        <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTag}
              className="rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100 gap-1.5 h-8.5"
            >
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
              <span>{copied ? "Copied" : "Copy ID"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100 gap-1.5 h-8.5"
            >
              <Printer className="size-3" />
              <span>Print Record</span>
            </Button>

            {isBatch && (
              <Link href={`/data-validation/batches?batchId=${encodeURIComponent(targetBatchId)}`}>
                <Button
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 h-8.5 shadow-2xs"
                >
                  <ExternalLink className="size-3" />
                  <span>Drilldown Batch Center</span>
                </Button>
              </Link>
            )}
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="rounded-xl text-xs font-bold px-4 h-8.5 border-slate-300 hover:bg-slate-100"
          >
            Close Inspector
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
