"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowRight,
  Baby,
  Beef,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Egg,
  FileText,
  MapPin,
  MessageSquare,
  Milk,
  MoreHorizontal,
  RotateCcw,
  Scissors,
  Search,
  Send,
  ShoppingBag,
  Sprout,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { UnifiedSubmissionItem } from "../sibat-analytics";

export type SibatProdStatusFilter = "all" | "pending" | "verified" | "approved" | "needs_correction" | "decided";

interface SibatProductionQueueProps {
  submissions: UnifiedSubmissionItem[];
  isLoading: boolean;
  onReview: (item: UnifiedSubmissionItem) => void;
  statusFilter: SibatProdStatusFilter;
  onStatusFilterChange: (st: SibatProdStatusFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  prodTypeFilter: string;
  onProdTypeFilterChange: (type: string) => void;
  focusRecordId?: string | null;
  scrollFocusKey?: string;
  onExport?: () => void;
}

function formatLogDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.slice(0, 10));
  if (!match) return dateStr;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, Number(day)));
}

function getLogCardVisuals(item: UnifiedSubmissionItem) {
  const pType = (
    item.productionType ||
    (item.submissionTypeLabel?.toLowerCase().includes("milk") ? "milk" : "") ||
    (item.submissionTypeLabel?.toLowerCase().includes("meat") ? "meat" : "") ||
    (item.submissionTypeLabel?.toLowerCase().includes("carcass") ? "meat" : "") ||
    (item.submissionTypeLabel?.toLowerCase().includes("slaughter") ? "meat" : "") ||
    (item.submissionTypeLabel?.toLowerCase().includes("egg") ? "eggs" : "") ||
    (item.submissionTypeLabel?.toLowerCase().includes("wool") ? "wool" : "") ||
    ""
  ).toLowerCase();

  if (item.sourceType === "PRODUCTION" || pType) {
    if (pType.includes("meat") || pType.includes("carcass") || pType.includes("slaughter")) {
      return {
        categoryLabel: "MEAT & CARCASS",
        icon: Beef,
        containerClass: "bg-[#fef7ee] border border-[#fed7aa]/80 text-[#b45309]",
      };
    }
    if (pType.includes("milk")) {
      return {
        categoryLabel: "DAILY MILK YIELD",
        icon: Milk,
        containerClass: "bg-blue-50 border border-blue-200/80 text-blue-700",
      };
    }
    if (pType.includes("wool")) {
      return {
        categoryLabel: "WOOL SHEARING",
        icon: Scissors,
        containerClass: "bg-slate-100 border border-slate-200 text-slate-700",
      };
    }
    if (pType.includes("egg")) {
      return {
        categoryLabel: "EGG COLLECTION",
        icon: Egg,
        containerClass: "bg-amber-50 border border-amber-200/80 text-amber-700",
      };
    }
    return {
      categoryLabel: "FARM HARVEST YIELD",
      icon: Sprout,
      containerClass: "bg-emerald-50 border border-emerald-200/80 text-emerald-800",
    };
  }

  if (item.sourceType === "SALE") {
    return {
      categoryLabel: "LIVESTOCK SALE",
      icon: ShoppingBag,
      containerClass: "bg-emerald-50 border border-emerald-200/80 text-emerald-800",
    };
  }

  if (item.sourceType === "CALVING") {
    return {
      categoryLabel: "CALVING & BIRTH EVENT",
      icon: Baby,
      containerClass: "bg-pink-50 border border-pink-200/80 text-pink-700",
    };
  }

  return {
    categoryLabel: item.submissionTypeLabel.toUpperCase(),
    icon: FileText,
    containerClass: "bg-slate-100 border border-slate-200 text-slate-700",
  };
}

export default function SibatProductionQueue(props: SibatProductionQueueProps) {
  return <SibatProductionQueueContent key={JSON.stringify([props.searchQuery, props.statusFilter, props.prodTypeFilter])} {...props} />;
}

function SibatProductionQueueContent({
  submissions,
  isLoading,
  onReview,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  prodTypeFilter,
  onProdTypeFilterChange,
  focusRecordId,
  scrollFocusKey,
}: SibatProductionQueueProps) {
  const [barangayFilter, setBarangayFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest_quantity">("newest");
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  const prodSubmissions = useMemo(() => {
    return submissions.filter(
      (s) => s.sourceType === "PRODUCTION" || s.sourceType === "CALVING" || s.sourceType === "SALE"
    );
  }, [submissions]);

  // Unique barangays for dropdown
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    prodSubmissions.forEach((s) => {
      if (s.barangayName) set.add(s.barangayName.trim());
    });
    return Array.from(set).sort();
  }, [prodSubmissions]);

  // Counts by status
  const counts = useMemo(() => {
    return {
      all: prodSubmissions.length,
      pending: prodSubmissions.filter((s) => s.status === "PENDING").length,
      verified: prodSubmissions.filter((s) => s.status === "VERIFIED").length,
      approved: prodSubmissions.filter((s) => s.status === "APPROVED").length,
      needs_correction: prodSubmissions.filter(
        (s) => s.status === "SUBJECT_TO_REVISION" || s.status === "SUBJECT_FOR_REVISION"
      ).length,
    };
  }, [prodSubmissions]);

  // Filtered
  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return prodSubmissions.filter((item) => {
      // 1. Status Filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && item.status === "PENDING") ||
        (statusFilter === "verified" && item.status === "VERIFIED") ||
        (statusFilter === "approved" && item.status === "APPROVED") ||
        (statusFilter === "needs_correction" &&
          (item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION"));

      // 2. Production Type Filter
      let matchesProdType = true;
      if (prodTypeFilter !== "ALL") {
        const pType = (item.productionType || item.submissionTypeLabel || "").toLowerCase();
        if (prodTypeFilter === "Milk") {
          matchesProdType = pType.includes("milk");
        } else if (prodTypeFilter === "Egg") {
          matchesProdType = pType.includes("egg");
        } else if (prodTypeFilter === "Meat") {
          matchesProdType = pType.includes("meat") || pType.includes("carcass") || pType.includes("slaughter");
        } else if (prodTypeFilter === "Calving") {
          matchesProdType = item.sourceType === "CALVING" || pType.includes("calving") || pType.includes("birth");
        } else if (prodTypeFilter === "Sale") {
          matchesProdType = item.sourceType === "SALE" || pType.includes("sale");
        } else if (prodTypeFilter === "Wool") {
          matchesProdType = pType.includes("wool");
        }
      }

      // 3. Barangay Filter
      const matchesBarangay =
        barangayFilter === "ALL" || item.barangayName.trim().toLowerCase() === barangayFilter.toLowerCase();

      // 4. Date Filter
      let matchesDate = true;
      if (dateFilter !== "ALL") {
        const itemDate = new Date(item.recordDate || item.createdAt);
        const now = new Date();
        if (dateFilter === "TODAY") {
          matchesDate = itemDate.toDateString() === now.toDateString();
        } else if (dateFilter === "THIS_WEEK") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = itemDate >= weekAgo;
        } else if (dateFilter === "THIS_MONTH") {
          matchesDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        } else if (dateFilter === "LAST_30_DAYS") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = itemDate >= monthAgo;
        }
      }

      // 5. Search Query
      const matchesSearch =
        !q ||
        item.farmerName.toLowerCase().includes(q) ||
        item.barangayName.toLowerCase().includes(q) ||
        item.livestockTypeName.toLowerCase().includes(q) ||
        item.detailsTitle.toLowerCase().includes(q) ||
        (item.damTag && item.damTag.toLowerCase().includes(q)) ||
        (item.calfTag && item.calfTag.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchesStatus && matchesProdType && matchesBarangay && matchesDate && matchesSearch;
    });
  }, [prodSubmissions, statusFilter, prodTypeFilter, barangayFilter, dateFilter, searchQuery]);

  // Sort
  const sortedSubmissions = useMemo(() => {
    const list = [...filteredSubmissions];
    if (sortBy === "oldest") {
      list.sort(
        (a, b) => new Date(a.recordDate || a.createdAt).getTime() - new Date(b.recordDate || b.createdAt).getTime()
      );
    } else if (sortBy === "highest_quantity") {
      list.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
    } else {
      list.sort(
        (a, b) => new Date(b.recordDate || b.createdAt).getTime() - new Date(a.recordDate || a.createdAt).getTime()
      );
    }
    return list;
  }, [filteredSubmissions, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    prodTypeFilter !== "ALL" ||
    barangayFilter !== "ALL" ||
    dateFilter !== "ALL";

  const PAGE_SIZE = 10;
  const [requestedPage, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(sortedSubmissions.length / PAGE_SIZE));
  const focusedIndex = focusRecordId ? sortedSubmissions.findIndex((item) => item.id === focusRecordId) : -1;
  const focusedPage = focusedIndex >= 0 ? Math.floor(focusedIndex / PAGE_SIZE) + 1 : null;
  const page = focusedPage ?? (requestedPage > pageCount ? 1 : requestedPage);
  const pagedSubmissions = useMemo(
    () => sortedSubmissions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sortedSubmissions, page]
  );

  useEffect(() => {
    if (!focusRecordId || focusedIndex < 0) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`production-record-${focusRecordId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRecordId, focusedIndex, page, scrollFocusKey]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ═══ 1. Five Status KPI Cards (From Mockup) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
        {/* Card 1: All logs */}
        <button
          type="button"
          onClick={() => onStatusFilterChange("all")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer flex flex-col justify-between shadow-2xs ${
            statusFilter === "all"
              ? "border-[#1b4332] bg-emerald-50/25 ring-1 ring-[#1b4332]"
              : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <FileText className="size-4.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">All logs</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 block">
            {counts.all}
          </span>
        </button>

        {/* Card 2: Waiting for review */}
        <button
          type="button"
          onClick={() => onStatusFilterChange("pending")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer flex flex-col justify-between shadow-2xs ${
            statusFilter === "pending"
              ? "border-amber-400 bg-amber-50/40 ring-1 ring-amber-400"
              : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="size-4.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Waiting for review</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-900 mt-2 block">
            {counts.pending}
          </span>
        </button>

        {/* Card 3: Sent to MAO */}
        <button
          type="button"
          onClick={() => onStatusFilterChange("verified")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer flex flex-col justify-between shadow-2xs ${
            statusFilter === "verified"
              ? "border-blue-400 bg-blue-50/40 ring-1 ring-blue-400"
              : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
              <Send className="size-4.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Sent to MAO</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-blue-700 mt-2 block">
            {counts.verified}
          </span>
        </button>

        {/* Card 4: Approved by MAO */}
        <button
          type="button"
          onClick={() => onStatusFilterChange("approved")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer flex flex-col justify-between shadow-2xs ${
            statusFilter === "approved"
              ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500"
              : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-4.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Approved by MAO</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-emerald-800 mt-2 block">
            {counts.approved}
          </span>
        </button>

        {/* Card 5: Needs correction */}
        <button
          type="button"
          onClick={() => onStatusFilterChange("needs_correction")}
          className={`p-4 rounded-2xl border transition-all text-left cursor-pointer flex flex-col justify-between shadow-2xs col-span-2 sm:col-span-1 ${
            statusFilter === "needs_correction"
              ? "border-rose-400 bg-rose-50/40 ring-1 ring-rose-400"
              : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0">
              <AlertCircle className="size-4.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Needs correction</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-rose-800 mt-2 block">
            {counts.needs_correction}
          </span>
        </button>
      </div>

      {/* ═══ 2. Filter Toolbar (Search + Dropdowns + Type Pills) ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
        {/* Top Filter Row: Search + Barangay + Date */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search farmer, barangay or livestock..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9.5 pr-8 bg-white border-slate-200 rounded-xl h-10 text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#1b4332] placeholder:text-slate-400"
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

          {/* Barangay Dropdown */}
          <div className="relative min-w-[170px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="h-10 w-full pl-8 pr-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#1b4332] cursor-pointer appearance-none truncate"
            >
              <option value="ALL">All Barangays</option>
              {uniqueBarangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Dropdown */}
          <div className="relative min-w-[150px]">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 w-full pl-8 pr-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#1b4332] cursor-pointer appearance-none truncate"
            >
              <option value="ALL">All dates</option>
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This week</option>
              <option value="THIS_MONTH">This month</option>
              <option value="LAST_30_DAYS">Last 30 days</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Bottom Filter Row: Production Type Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar flex-wrap sm:flex-nowrap">
          {/* All types */}
          <button
            type="button"
            onClick={() => onProdTypeFilterChange("ALL")}
            className={`h-9 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              prodTypeFilter === "ALL"
                ? "bg-[#1b4332] text-white shadow-2xs"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
            }`}
          >
            All types
          </button>

          {/* Milk */}
          <button
            type="button"
            onClick={() => onProdTypeFilterChange("Milk")}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              prodTypeFilter === "Milk"
                ? "bg-[#1b4332] text-white shadow-2xs"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
            }`}
          >
            <Milk className="size-3.5 text-sky-600" />
            Milk
          </button>

          {/* Eggs */}
          <button
            type="button"
            onClick={() => onProdTypeFilterChange("Egg")}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              prodTypeFilter === "Egg"
                ? "bg-[#1b4332] text-white shadow-2xs"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
            }`}
          >
            <Egg className="size-3.5 text-amber-600" />
            Eggs
          </button>

          {/* Meat */}
          <button
            type="button"
            onClick={() => onProdTypeFilterChange("Meat")}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              prodTypeFilter === "Meat"
                ? "bg-[#1b4332] text-white shadow-2xs"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
            }`}
          >
            <Beef className="size-3.5 text-rose-600" />
            Meat
          </button>

          {/* Calving & Births */}
          <button
            type="button"
            onClick={() => onProdTypeFilterChange("Calving")}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              prodTypeFilter === "Calving"
                ? "bg-[#1b4332] text-white shadow-2xs"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
            }`}
          >
            <Baby className="size-3.5 text-pink-600" />
            Calving & Births
          </button>

          {/* Sales */}
          <button
            type="button"
            onClick={() => onProdTypeFilterChange("Sale")}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              prodTypeFilter === "Sale"
                ? "bg-[#1b4332] text-white shadow-2xs"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
            }`}
          >
            <ShoppingBag className="size-3.5 text-emerald-700" />
            Sales
          </button>

          {/* More options button (...) */}
          <button
            type="button"
            onClick={() => setShowMoreTypes(!showMoreTypes)}
            className={`h-9 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
              showMoreTypes || prodTypeFilter === "Wool"
                ? "bg-slate-100 border-slate-300 text-slate-900"
                : "border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
            }`}
            title="More types"
          >
            <MoreHorizontal className="size-4" />
          </button>

          {/* Wool (revealed if more clicked or selected) */}
          {(showMoreTypes || prodTypeFilter === "Wool") && (
            <button
              type="button"
              onClick={() => onProdTypeFilterChange("Wool")}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer animate-in fade-in duration-200 ${
                prodTypeFilter === "Wool"
                  ? "bg-[#1b4332] text-white shadow-2xs"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"
              }`}
            >
              <Scissors className="size-3.5 text-slate-600" />
              Wool
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                onStatusFilterChange("all");
                onProdTypeFilterChange("ALL");
                setBarangayFilter("ALL");
                setDateFilter("ALL");
              }}
              className="ml-auto text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg shrink-0 cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* ═══ 3. Subtitle Count & Sort Bar ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <span className="text-xs sm:text-sm text-slate-500 font-medium">
          Showing {pagedSubmissions.length} of {sortedSubmissions.length} logs
          {statusFilter === "pending"
            ? " awaiting review"
            : statusFilter === "verified"
            ? " sent to MAO"
            : statusFilter === "approved"
            ? " approved by MAO"
            : statusFilter === "needs_correction"
            ? " requiring correction"
            : ""}
        </span>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-xs text-slate-500 font-medium">Sort:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "highest_quantity")}
              className="text-xs font-semibold text-slate-800 bg-transparent hover:text-slate-900 pr-5 py-1 focus:outline-none cursor-pointer appearance-none"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest_quantity">Highest quantity</option>
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ═══ 4. Log Cards List ═══ */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-slate-200 bg-white rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-12 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-9 w-32 rounded-xl" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedSubmissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3 shadow-2xs">
          <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-xl font-black">
            📋
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            {hasActiveFilters ? "No matching production logs" : "All Caught Up on Review Logs!"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            {hasActiveFilters
              ? "No yield logs matched your search filters. Try adjusting your search query or reset filters."
              : "No farmer production yields are waiting for review in your assigned sector right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedSubmissions.map((item) => {
            const isPending = item.status === "PENDING";
            const visuals = getLogCardVisuals(item);
            const CardIcon = visuals.icon;

            return (
              <Card
                key={item.id}
                id={`production-record-${item.id}`}
                className={`group rounded-2xl border transition-all shadow-2xs hover:shadow-md overflow-hidden ${
                  item.id === focusRecordId
                    ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-300 shadow-md"
                    : "border-slate-200/90 bg-white hover:border-slate-300"
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Icon Badge & Quantity / Enterprise */}
                    <div className="flex items-center gap-4 min-w-[240px]">
                      <div
                        className={`size-13 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${visuals.containerClass}`}
                      >
                        <CardIcon className="size-6" />
                      </div>

                      <div className="min-w-0">
                        <span className="text-[10.5px] font-bold tracking-wider text-slate-400 uppercase block">
                          {visuals.categoryLabel}
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            {item.quantityDisplay}
                          </span>
                          <span className="text-slate-300 font-light">|</span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-500 truncate">
                            {item.livestockTypeName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Farmer, Barangay, Date & Notes */}
                    <div className="flex-1 min-w-0 space-y-1.5 lg:px-4 lg:border-l lg:border-slate-100">
                      <div className="flex items-center gap-3.5 text-xs flex-wrap font-medium">
                        <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
                          <User className="size-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px] sm:max-w-none">{item.farmerName}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="size-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{item.barangayName}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Calendar className="size-3.5 text-slate-400 shrink-0" />
                          <span>{formatLogDate(item.recordDate || item.createdAt)}</span>
                        </span>
                      </div>

                      {/* Notes / Remarks row */}
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MessageSquare className="size-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-600 text-[11.5px] sm:text-xs truncate">
                          {item.notes
                            ? item.notes
                            : item.salePurpose
                            ? `Purpose: ${item.salePurpose}`
                            : "Logged without remarks"}
                        </span>
                      </div>
                    </div>

                    {/* Right: Status Pill & Action Button */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {/* Status Badge */}
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-xs font-semibold border border-amber-200/60 whitespace-nowrap shadow-2xs">
                          <Clock className="size-3.5 text-amber-700" />
                          Waiting for review
                        </span>
                      ) : item.status === "VERIFIED" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold border border-blue-200 whitespace-nowrap shadow-2xs">
                          <Send className="size-3.5 text-blue-700" />
                          Sent to MAO
                        </span>
                      ) : item.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 whitespace-nowrap shadow-2xs">
                          <CheckCircle2 className="size-3.5 text-emerald-700" />
                          Approved by MAO
                        </span>
                      ) : item.status === "SUBJECT_TO_REVISION" || item.status === "SUBJECT_FOR_REVISION" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-semibold border border-rose-200 whitespace-nowrap shadow-2xs">
                          <AlertCircle className="size-3.5 text-rose-700" />
                          Needs correction
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 whitespace-nowrap shadow-2xs">
                          {item.status}
                        </span>
                      )}

                      {/* Action Button */}
                      {isPending ? (
                        <Button
                          onClick={() => onReview(item)}
                          className="h-9 px-4 rounded-xl bg-[#1b4332] hover:bg-[#143326] text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                        >
                          <span>Review & Verify</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => onReview(item)}
                          className="h-9 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs cursor-pointer transition-all"
                        >
                          View verification
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══ 5. Bottom Pagination (From Mockup) ═══ */}
      {sortedSubmissions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500 font-medium">
            {pageCount <= 1
              ? `1-${sortedSubmissions.length} of ${sortedSubmissions.length} logs`
              : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, sortedSubmissions.length)} of ${sortedSubmissions.length} logs`}
          </span>

          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="size-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 cursor-pointer shadow-2xs transition-all"
                title="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>

              {/* Page numbers */}
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((pNum) => {
                const isActive = pNum === page;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setPage(pNum)}
                    className={`size-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      isActive
                        ? "bg-[#1b4332] text-white shadow-2xs"
                        : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              {/* Next */}
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="size-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-slate-600 cursor-pointer shadow-2xs transition-all"
                title="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
