"use client";

import React, { useMemo } from "react";
import {
  Stethoscope,
  Skull,
  Search,
  RotateCcw,
  Tag,
  MapPin,
  User,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ClipboardCheck,
  ShieldCheck,
  ChevronRight,
  HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SibatStatusBadge from "./sibat-status-badge";
import type { SibatValidationRecord } from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";

interface SibatHealthQueueProps {
  records: SibatValidationRecord[];
  isLoading: boolean;
  onInspectRecord: (record: SibatValidationRecord) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  typeFilter: "ALL" | "DISEASE" | "MORTALITY";
  onTypeFilterChange: (t: "ALL" | "DISEASE" | "MORTALITY") => void;
  barangayFilter: string;
  onBarangayFilterChange: (b: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const STATUS_TABS = [
  { value: "ALL", label: "All Cases", emoji: "📋" },
  { value: "PENDING", label: "Needs Field Visit", emoji: "⏳" },
  { value: "VERIFIED", label: "Verified / In MAO Queue", emoji: "✨" },
  { value: "APPROVED", label: "MAO Certified", emoji: "✅" },
  { value: "REJECTED", label: "For Revision", emoji: "🔄" },
];

const getAnimalEmoji = (typeStr: string = "") => {
  const t = typeStr.toLowerCase();
  if (t.includes("cattle") || t.includes("baka")) return "🐮";
  if (t.includes("carabao") || t.includes("kalabaw")) return "🐃";
  if (t.includes("swine") || t.includes("pig") || t.includes("baboy")) return "🐷";
  if (t.includes("goat") || t.includes("kambing")) return "🐐";
  if (t.includes("sheep") || t.includes("tupa")) return "🐑";
  if (t.includes("poultry") || t.includes("chicken") || t.includes("manok") || t.includes("duck")) return "🐓";
  return "🐾";
};

export default function SibatHealthQueue({
  records,
  isLoading,
  onInspectRecord,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  barangayFilter,
  onBarangayFilterChange,
  searchQuery,
  onSearchChange,
}: SibatHealthQueueProps) {
  // Counts by status
  const counts = useMemo(() => {
    return {
      all: records.length,
      pending: records.filter((r) => r.status === "PENDING").length,
      verified: records.filter((r) => r.status === "VERIFIED").length,
      approved: records.filter((r) => r.status === "APPROVED").length,
      rejected: records.filter((r) => r.status === "REJECTED" || r.status === "FLAGGED").length,
    };
  }, [records]);

  // Unique Barangays
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.barangayName && set.add(r.barangayName));
    return Array.from(set).sort();
  }, [records]);

  // Filtered List
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return records.filter((rec) => {
      const matchesSearch =
        !q ||
        rec.farmerName.toLowerCase().includes(q) ||
        rec.livestockTag.toLowerCase().includes(q) ||
        rec.barangayName.toLowerCase().includes(q) ||
        rec.name.toLowerCase().includes(q) ||
        rec.farmerDescription.toLowerCase().includes(q) ||
        rec.id.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "ALL" ||
        rec.status === statusFilter ||
        (statusFilter === "REJECTED" && (rec.status === "REJECTED" || rec.status === "FLAGGED"));

      const matchesType = typeFilter === "ALL" || rec.reportType === typeFilter;
      const matchesBarangay = barangayFilter === "ALL" || rec.barangayName === barangayFilter;

      return matchesSearch && matchesStatus && matchesType && matchesBarangay;
    });
  }, [records, searchQuery, statusFilter, typeFilter, barangayFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    barangayFilter !== "ALL";

  return (
    <div className="space-y-4">
      {/* Friendly Section Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-rose-50/60 border border-rose-100 p-4 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black shadow-xs">
            <HeartPulse className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
              Clinical Health & Mortality Visits
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              Check in on sick animals, verify symptoms, and give biosecurity advice on the farm.
            </p>
          </div>
        </div>

        {counts.pending > 0 && (
          <Badge className="bg-rose-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-2xs self-start sm:self-center">
            {counts.pending} {counts.pending === 1 ? "visit waiting" : "visits waiting"}
          </Badge>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-3.5 space-y-3">
        {/* Row 1: Search & Type Filter & Barangay */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search by farmer name, barangay, symptom, ear tag #..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9.5 pr-9 bg-slate-50/80 border-slate-200 rounded-2xl h-10 text-xs focus-visible:ring-[#1A365D]/20 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Type selector */}
            <div className="flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => onTypeFilterChange("ALL")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  typeFilter === "ALL"
                    ? "bg-[#1A365D] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Reports
              </button>
              <button
                type="button"
                onClick={() => onTypeFilterChange("DISEASE")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  typeFilter === "DISEASE"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🩺 Illnesses
              </button>
              <button
                type="button"
                onClick={() => onTypeFilterChange("MORTALITY")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  typeFilter === "MORTALITY"
                    ? "bg-slate-800 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                💀 Mortalities
              </button>
            </div>

            {/* Barangay selector */}
            <select
              value={barangayFilter}
              onChange={(e) => onBarangayFilterChange(e.target.value)}
              className="h-10 px-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1A365D]/20 cursor-pointer"
            >
              <option value="ALL">📍 All Barangays ({uniqueBarangays.length})</option>
              {uniqueBarangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Status Pills */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === "ALL"
                ? counts.all
                : tab.value === "PENDING"
                ? counts.pending
                : tab.value === "VERIFIED"
                ? counts.verified
                : tab.value === "APPROVED"
                ? counts.approved
                : counts.rejected;

            const isActive = statusFilter === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onStatusFilterChange(tab.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                  isActive
                    ? "bg-[#1A365D] text-white border-[#1A365D] shadow-2xs"
                    : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange("");
                onStatusFilterChange("ALL");
                onTypeFilterChange("ALL");
                onBarangayFilterChange("ALL");
              }}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 px-2.5 font-bold ml-auto shrink-0 rounded-xl"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-slate-200 bg-white rounded-3xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-12 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-10 w-32 rounded-2xl" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-3 shadow-2xs">
          <div className="size-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-black">
            🌾
          </div>
          <h3 className="text-base font-black text-slate-800">
            {hasActiveFilters ? "No matching cases found" : "All Clear! No Pending Health Issues"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            {hasActiveFilters
              ? "We couldn't find any health reports matching your search or filters. Try adjusting them!"
              : "There are no reported sick or deceased animals waiting for inspection right now. Great job keeping the herds safe!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const isDisease = record.reportType === "DISEASE";
            const isPending = record.status === "PENDING";
            const animalEmoji = getAnimalEmoji(record.livestockType);

            return (
              <Card
                key={record.id}
                className="group border-slate-200/80 bg-white hover:border-[#1A365D]/30 transition-all shadow-2xs hover:shadow-md rounded-3xl overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Animal Emoji Avatar & Information */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={`size-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-2xl shadow-2xs ${
                          isDisease
                            ? "bg-rose-50 text-rose-600 border border-rose-200/80"
                            : "bg-slate-800 text-amber-300 border border-slate-700"
                        }`}
                      >
                        {animalEmoji}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-[10px] font-black tracking-wider uppercase rounded-md px-2 py-0.5 ${
                              isDisease
                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                : "bg-slate-200 text-slate-900 border-slate-300"
                            }`}
                          >
                            {isDisease ? "🩺 Illness Check" : "💀 Mortality"}
                          </Badge>

                          <SibatStatusBadge status={record.status} />

                          <span className="text-[11px] font-bold text-slate-400">
                            📅 {record.reportedDate}
                          </span>
                        </div>

                        {/* Title: Friendly statement */}
                        <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>{record.name}</span>
                          <span className="text-slate-400 font-normal text-xs">•</span>
                          <span className="text-amber-700 font-extrabold text-xs">
                            Tag #{record.livestockTag}
                          </span>
                        </h4>

                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap font-medium">
                          <span className="flex items-center gap-1 text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-lg">
                            <User className="size-3 text-slate-400" />
                            {record.farmerName}
                          </span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="size-3 text-slate-400" />
                            {record.barangayName}
                          </span>
                          <span className="text-slate-600 font-medium">
                            Breed: <strong>{record.livestockBreed}</strong>
                          </span>
                          <span className="text-slate-500 font-semibold">
                            Affected: <strong className="text-slate-900">{record.reportedCount} Head(s)</strong>
                          </span>
                        </div>

                        {record.farmerDescription && (
                          <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 mt-1">
                            <strong className="text-slate-900 font-bold">Farmer&apos;s note: </strong>
                            &ldquo;{record.farmerDescription}&rdquo;
                          </div>
                        )}

                        {record.inspection && (
                          <div className="text-[11px] bg-sky-50 text-sky-950 p-2.5 rounded-2xl border border-sky-200/80 mt-1 flex items-start gap-2">
                            <ShieldCheck className="size-4 text-sky-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">
                                ✨ Your Field Findings: {record.inspection.remarks}
                              </p>
                              <p className="text-[10px] text-sky-700 font-semibold mt-0.5">
                                Severity: {record.inspection.severity} • Action: {record.inspection.biosecurityAction} • By: {record.inspection.verifiedBy}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Friendly CTA Button */}
                    <div className="flex items-center gap-2 shrink-0 lg:self-center">
                      <Button
                        onClick={() => onInspectRecord(record)}
                        className={`h-10 px-4 rounded-2xl text-xs font-black gap-1.5 transition-all shadow-2xs cursor-pointer ${
                          isPending
                            ? "bg-[#1A365D] hover:bg-[#132742] text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                        }`}
                      >
                        {isPending ? (
                          <>
                            <ClipboardCheck className="size-4 text-amber-300" />
                            Start On-Site Field Check
                          </>
                        ) : (
                          <>
                            <Eye className="size-4 text-slate-600" />
                            View Field Notes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
