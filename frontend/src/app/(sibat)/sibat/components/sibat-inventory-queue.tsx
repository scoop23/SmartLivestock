"use client";

import React, { useMemo } from "react";
import {
  Tag,
  Search,
  RotateCcw,
  Calendar,
  MapPin,
  User,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ClipboardCheck,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SibatStatusBadge from "./sibat-status-badge";
import type { UnifiedSubmissionItem } from "../sibat-analytics";

interface SibatInventoryQueueProps {
  submissions: UnifiedSubmissionItem[];
  isLoading: boolean;
  onReview: (item: UnifiedSubmissionItem) => void;
  statusFilter: "all" | "pending" | "verified" | "decided";
  onStatusFilterChange: (st: "all" | "pending" | "verified" | "decided") => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  entryTypeFilter: "ALL" | "INDIVIDUAL" | "BATCH";
  onEntryTypeFilterChange: (type: "ALL" | "INDIVIDUAL" | "BATCH") => void;
}

const STATUS_TABS: Array<{
  value: "all" | "pending" | "verified" | "decided";
  label: string;
  emoji: string;
}> = [
  { value: "all", label: "All Animals", emoji: "📋" },
  { value: "pending", label: "Needs Tag Check", emoji: "⏳" },
  { value: "verified", label: "Verified / In MAO Queue", emoji: "✨" },
  { value: "decided", label: "MAO Certified", emoji: "✅" },
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

export default function SibatInventoryQueue({
  submissions,
  isLoading,
  onReview,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  entryTypeFilter,
  onEntryTypeFilterChange,
}: SibatInventoryQueueProps) {
  // Filter for INVENTORY (individual animals) and BATCH (cohort herds)
  const invSubmissions = useMemo(() => {
    return submissions.filter((s) => s.sourceType === "INVENTORY" || s.sourceType === "BATCH");
  }, [submissions]);

  // Counts by status
  const counts = useMemo(() => {
    return {
      all: invSubmissions.length,
      pending: invSubmissions.filter((s) => s.status === "PENDING").length,
      verified: invSubmissions.filter((s) => s.status === "VERIFIED").length,
      decided: invSubmissions.filter((s) => s.status === "APPROVED" || s.status === "SUBJECT_TO_REVISION" || s.status === "REJECTED").length,
    };
  }, [invSubmissions]);

  // Filtered
  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return invSubmissions.filter((item) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && item.status === "PENDING") ||
        (statusFilter === "verified" && item.status === "VERIFIED") ||
        (statusFilter === "decided" && (item.status === "APPROVED" || item.status === "SUBJECT_TO_REVISION" || item.status === "REJECTED"));

      const matchesEntryType =
        entryTypeFilter === "ALL" || item.entryType === entryTypeFilter;

      const matchesSearch =
        !q ||
        item.farmerName.toLowerCase().includes(q) ||
        item.barangayName.toLowerCase().includes(q) ||
        item.livestockTypeName.toLowerCase().includes(q) ||
        (item.tagNumber && item.tagNumber.toLowerCase().includes(q)) ||
        (item.breed && item.breed.toLowerCase().includes(q)) ||
        item.detailsTitle.toLowerCase().includes(q);

      return matchesStatus && matchesEntryType && matchesSearch;
    });
  }, [invSubmissions, statusFilter, entryTypeFilter, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || statusFilter !== "all" || entryTypeFilter !== "ALL";

  return (
    <div className="space-y-4">
      {/* Friendly Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-amber-50/60 border border-amber-100 p-4 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs">
            <Tag className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
              Livestock Inventory & Ear Tagging
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              Verify ear tag numbers, breed accuracy, and individual animal health status on the farm.
            </p>
          </div>
        </div>

        {counts.pending > 0 && (
          <Badge className="bg-amber-600 text-white font-extrabold text-xs px-3 py-1 rounded-full shadow-2xs self-start sm:self-center">
            {counts.pending} {counts.pending === 1 ? "animal to tag" : "animals to tag"}
          </Badge>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-3.5 space-y-3">
        {/* Row 1: Search & Type */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search ear tag #, breed, farmer name, barangay..."
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
            <div className="flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => onEntryTypeFilterChange("ALL")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  entryTypeFilter === "ALL"
                    ? "bg-[#1A365D] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Animals
              </button>
              <button
                type="button"
                onClick={() => onEntryTypeFilterChange("INDIVIDUAL")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  entryTypeFilter === "INDIVIDUAL"
                    ? "bg-[#1A365D] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🏷️ Tagged Animals
              </button>
              <button
                type="button"
                onClick={() => onEntryTypeFilterChange("BATCH")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  entryTypeFilter === "BATCH"
                    ? "bg-[#1A365D] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📦 Batch Herds
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Status Pills */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count = counts[tab.value];
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
                onStatusFilterChange("all");
                onEntryTypeFilterChange("ALL");
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
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-3 shadow-2xs">
          <div className="size-14 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-2xl font-black">
            🏷️
          </div>
          <h3 className="text-base font-black text-slate-800">
            {hasActiveFilters ? "No matching animal records" : "All Animal Registrations Tagged!"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            {hasActiveFilters
              ? "No livestock records matched your search or filters. Try adjusting them!"
              : "There are no pending livestock inventory registrations waiting for tag verification."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((item) => {
            const isPending = item.status === "PENDING";
            const isIndividual = item.entryType === "INDIVIDUAL";
            const emoji = getAnimalEmoji(item.livestockTypeName || item.detailsTitle);

            return (
              <Card
                key={item.id}
                className="group border-slate-200/80 bg-white hover:border-[#1A365D]/30 transition-all shadow-2xs hover:shadow-md rounded-3xl overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Icon & Details */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="size-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-2xl bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
                        {emoji}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] font-black uppercase rounded-md px-2 py-0.5">
                            {item.submissionTypeLabel}
                          </Badge>

                          {item.batchCode && isIndividual && (
                            <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold">
                              Cohort: {item.batchCode}
                            </Badge>
                          )}

                          <SibatStatusBadge status={item.status} />

                          <span className="text-[11px] font-bold text-slate-400">
                            📅 Registered: {item.recordDate}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-2">
                          <h4 className="text-base font-black text-slate-900">
                            {isIndividual ? (
                              <>Ear Tag: #{item.tagNumber || "Unassigned"}</>
                            ) : (
                              <>Cohort: {item.tagNumber || item.batchCode || `Batch #${item.rawId}`}</>
                            )}
                          </h4>
                          <span className="text-xs text-slate-500 font-bold">
                            • {item.livestockTypeName} ({item.breed || "Standard Breed"})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap font-medium">
                          <span className="flex items-center gap-1 text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-lg">
                            <User className="size-3 text-slate-400" />
                            {item.farmerName}
                          </span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="size-3 text-slate-400" />
                            {item.barangayName}
                          </span>
                          {item.sex && (
                            <span className="text-slate-700 font-semibold">
                              Sex: <strong>{item.sex}</strong>
                            </span>
                          )}
                          {item.weight && (
                            <span className="flex items-center gap-1 text-slate-700 font-semibold">
                              <Scale className="size-3 text-slate-400" />
                              {item.weight} kg{isIndividual ? "" : " (Avg)"}
                            </span>
                          )}
                          {item.housingPen && (
                            <span className="text-slate-600 font-medium">
                              Pen: <strong>{item.housingPen}</strong>
                            </span>
                          )}
                        </div>

                        {item.reviewRemarks && (
                          <div className="text-[11px] bg-amber-50 text-amber-950 p-2.5 rounded-2xl border border-amber-200/80 mt-1">
                            <strong className="font-bold text-amber-900">✨ Your Inspection Note: </strong>
                            {item.reviewRemarks}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: CTA Button */}
                    <div className="flex items-center gap-2 shrink-0 lg:self-center">
                      <Button
                        onClick={() => onReview(item)}
                        className={`h-10 px-4 rounded-2xl text-xs font-black gap-1.5 transition-all shadow-2xs cursor-pointer ${
                          isPending
                            ? "bg-[#1A365D] hover:bg-[#132742] text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                        }`}
                      >
                        {isPending ? (
                          <>
                            <ClipboardCheck className="size-4 text-amber-300" />
                            {isIndividual ? "Verify Tag & Animal" : "Verify Cohort Batch"}
                          </>
                        ) : (
                          <>
                            <Eye className="size-4 text-slate-600" />
                            View Verification
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
