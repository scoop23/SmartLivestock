"use client";

import { useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SibatStatusBadge from "./sibat-status-badge";
import type { UnifiedSubmissionItem, UnifiedSubmissionType } from "../sibat-analytics";

interface SibatSubmissionQueueProps {
  submissions: UnifiedSubmissionItem[];
  isLoading: boolean;
  onReview: (item: UnifiedSubmissionItem) => void;
  activeStatus: "all" | "pending" | "verified" | "decided";
  onStatusChange: (status: "all" | "pending" | "verified" | "decided") => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: UnifiedSubmissionType;
  onTypeChange: (type: UnifiedSubmissionType) => void;
}

const STATUS_CHIPS: Array<{
  value: "all" | "pending" | "verified" | "decided";
  label: string;
  dotClass: string;
  activeClass: string;
}> = [
  {
    value: "all",
    label: "All Submissions",
    dotClass: "bg-slate-400",
    activeClass: "bg-[#1A365D] text-white border-[#1A365D] shadow-sm",
  },
  {
    value: "pending",
    label: "Pending Review",
    dotClass: "bg-amber-500",
    activeClass: "bg-amber-600 text-white border-amber-600 shadow-sm",
  },
  {
    value: "verified",
    label: "Verified / In MAO Queue",
    dotClass: "bg-sky-500",
    activeClass: "bg-sky-700 text-white border-sky-700 shadow-sm",
  },
  {
    value: "decided",
    label: "MAO Decided",
    dotClass: "bg-emerald-500",
    activeClass: "bg-emerald-700 text-white border-emerald-700 shadow-sm",
  },
];

export default function SibatSubmissionQueue({
  submissions,
  isLoading,
  onReview,
  activeStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
}: SibatSubmissionQueueProps) {
  // Counts by status
  const counts = useMemo(() => {
    return {
      all: submissions.length,
      pending: submissions.filter((s) => s.status === "PENDING").length,
      verified: submissions.filter((s) => s.status === "VERIFIED").length,
      decided: submissions.filter((s) => s.status === "APPROVED" || s.status === "REJECTED").length,
    };
  }, [submissions]);

  // Filter pipeline
  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return submissions.filter((item) => {
      // Status filter
      const matchesStatus =
        activeStatus === "all" ||
        (activeStatus === "pending" && item.status === "PENDING") ||
        (activeStatus === "verified" && item.status === "VERIFIED") ||
        (activeStatus === "decided" && (item.status === "APPROVED" || item.status === "REJECTED"));

      // Type filter
      const matchesType =
        selectedType === "ALL" || item.sourceType === selectedType;

      // Search query filter
      const matchesSearch =
        !q ||
        item.farmerName.toLowerCase().includes(q) ||
        item.barangayName.toLowerCase().includes(q) ||
        item.livestockTypeName.toLowerCase().includes(q) ||
        (item.tagNumber && item.tagNumber.toLowerCase().includes(q)) ||
        item.detailsTitle.toLowerCase().includes(q);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [submissions, activeStatus, selectedType, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Layers className="size-5 text-[#1A365D]" />
            Farmer Submissions Review Queue
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Inspect daily yields and livestock registrations submitted by local farmers for cooperative validation.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Row 1: Search & Type Filter */}
        <div className="p-3 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search farmer name, barangay, livestock type, ear tag..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-xs focus-visible:ring-[#1A365D]/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Submission Type Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => onTypeChange("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedType === "ALL"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => onTypeChange("PRODUCTION")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedType === "PRODUCTION"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Production Yields
            </button>
            <button
              type="button"
              onClick={() => onTypeChange("INVENTORY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedType === "INVENTORY"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Livestock Entries
            </button>
          </div>

          {(searchQuery || activeStatus !== "all" || selectedType !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onSearchChange("");
                onStatusChange("all");
                onTypeChange("ALL");
              }}
              className="rounded-xl text-xs font-bold gap-1.5 h-10 shrink-0 border-slate-200"
            >
              <RotateCcw className="size-3" />
              Reset Filters
            </Button>
          )}
        </div>

        <Separator className="opacity-60" />

        {/* Row 2: Status chips */}
        <div className="px-3 py-2.5 flex items-center gap-1.5 flex-wrap">
          <SlidersHorizontal className="size-3.5 text-slate-400 mr-0.5 shrink-0 hidden sm:block" />
          {STATUS_CHIPS.map((chip) => {
            const isActive = activeStatus === chip.value;
            const count = counts[chip.value] ?? 0;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => onStatusChange(chip.value)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                  border transition-all duration-200 active:scale-95 cursor-pointer
                  ${isActive
                    ? chip.activeClass
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }
                `}
              >
                {!isActive && <span className={`size-1.5 rounded-full ${chip.dotClass}`} />}
                {chip.label}
                <span
                  className={`text-[10px] font-extrabold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full leading-none ${
                    isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
        <p>
          Showing <strong className="text-slate-900 font-extrabold">{filteredSubmissions.length}</strong> of <strong className="text-slate-900 font-extrabold">{submissions.length}</strong> submissions
        </p>
      </div>

      {/* Queue List Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <Card className="py-12 border-dashed border-slate-200 rounded-2xl bg-white">
            <CardContent className="flex flex-col items-center text-center space-y-3 px-6">
              <div className="p-3 rounded-2xl bg-slate-100 text-slate-400">
                <Search className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  No Farmer Submissions Found
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  {searchQuery
                    ? `No submissions matched "${searchQuery}". Try clearing search filters.`
                    : activeStatus === "pending"
                    ? "Great job! All farmer submissions in your sector have been reviewed."
                    : "No submissions match the selected filter criteria."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredSubmissions.map((item) => {
            const isPending = item.status === "PENDING";
            return (
              <Card
                key={item.id}
                className={`relative overflow-hidden border-2 shadow-xs hover:shadow-sm rounded-2xl transition-all duration-200 bg-white ${
                  isPending
                    ? "border-amber-200 hover:border-amber-300"
                    : item.status === "VERIFIED"
                    ? "border-sky-200 hover:border-sky-300"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                        <User className="size-4 text-slate-500" />
                        {item.farmerName}
                      </h3>
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-bold text-[10px]">
                        <MapPin className="size-2.5 mr-1 text-slate-400" />
                        {item.barangayName}
                      </Badge>
                      <Badge className="bg-blue-50 text-blue-800 border-blue-200 font-bold text-[10px]">
                        {item.submissionTypeLabel}
                      </Badge>
                      <SibatStatusBadge status={item.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                      <span className="font-semibold text-slate-800">
                        {item.detailsTitle}
                      </span>
                      <span>
                        Quantity / Yield: <strong className="text-emerald-800">{item.quantityDisplay}</strong>
                      </span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar className="size-3" />
                        {item.recordDate}
                      </span>
                    </div>

                    {item.notes && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-1">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      onClick={() => onReview(item)}
                      className={`text-xs font-bold rounded-xl gap-1.5 shadow-2xs h-9 px-3.5 ${
                        isPending
                          ? "bg-[#1A365D] hover:bg-[#152944] text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                      }`}
                    >
                      <Eye className="size-3.5" />
                      {isPending ? "Review Submission" : "View Details"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
