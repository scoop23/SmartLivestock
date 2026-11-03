"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/ui/kpi-card";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeftRight,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Info,
  ListFilter,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  UserCheck,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type Transfer = {
  id: number;
  livestock: number | null;
  livestock_tag: string;
  livestock_type_name: string;
  livestock_operational_status?: string;
  previous_owner_name: string;
  new_owner_name: string;
  owner_type?: string;
  external_owner_name?: string;
  external_owner_address?: string;
  external_seller_name?: string;
  external_seller_address?: string;
  transfer_certificate_number: string;
  original_certificate_number: string;
  transfer_date: string;
  status: string;
  municipality: string;
  province: string;
  animal_description: string;
  sex_at_transfer: string;
  age_at_transfer: string;
  municipality_brand: string;
  owner_brand: string;
  purchase_price: string | null;
  origin_municipality: string;
  origin_province: string;
  review_remarks?: string;
  reviewed_by_name?: string;
  created_at?: string;
};

export function OwnershipTransfersQueue({ reviewer }: { reviewer: "SIBAT" | "MAO" }) {
  const client = useQueryClient();
  const isMao = reviewer === "MAO";

  // MAO review default tab: PENDING (focus directly on transfers awaiting MAO approval)
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [speciesFilter, setSpeciesFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<Transfer | null>(null);
  const [revisionRemarks, setRevisionRemarks] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Manila Clock
  const [clockString, setClockString] = useState<string>("");
  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const updateTime = () => setClockString(`${formatter.format(new Date())} PHT`);
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live backend records from Django PostgreSQL
  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ownership-transfers"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
  });

  // Deep-linking from notification or URL ?transferId=123
  useEffect(() => {
    if (isLoading || !data.length) return;
    const transferId = new URLSearchParams(window.location.search).get("transferId");
    if (!transferId) return;
    const found = data.find((item) => String(item.id) === transferId);
    if (!found) return;

    // Switch to ALL or match status so the deep-linked row is visible
    setStatusFilter("ALL");
    setSelectedTransfer(found);
    const card = document.getElementById(`ownership-transfer-${transferId}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });

    const url = new URL(window.location.href);
    url.searchParams.delete("transferId");
    window.history.replaceState({}, "", url.toString());
  }, [data, isLoading]);

  // Review Mutation (MAO Approval / Revision)
  const review = useMutation({
    mutationFn: async ({
      id,
      status,
      remarks = "",
    }: {
      id: number;
      status: "APPROVED" | "SUBJECT_TO_REVISION";
      remarks?: string;
    }) => api.post(`livestock/ownership-transfers/${id}/review/`, { status, remarks }),
    onSuccess: async (_, variables) => {
      await client.invalidateQueries({ queryKey: ["ownership-transfers"] });
      await client.invalidateQueries({ queryKey: ["inventory"] });
      setRevisionTarget(null);
      setRevisionRemarks("");
      setSelectedTransfer(null);
      if (variables.status === "APPROVED") {
        toast.success("Transfer certificate officially approved.");
      } else {
        toast.info("Transfer returned to Auction Officer for correction.");
      }
    },
    onError: () => toast.error("Unable to update ownership transfer status."),
  });

  // Distinct species options
  const speciesOptions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => {
      if (t.livestock_type_name) set.add(t.livestock_type_name);
    });
    return ["ALL", ...Array.from(set)];
  }, [data]);

  // Status counts for MAO workflow
  const counts = useMemo(() => {
    const pending = data.filter((t) => ["PENDING", "VERIFIED"].includes(t.status)).length;
    const approved = data.filter((t) => t.status === "APPROVED").length;
    const revision = data.filter((t) => ["SUBJECT_TO_REVISION", "REJECTED"].includes(t.status)).length;
    const total = data.length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 100;
    return { pending, approved, revision, total, approvalRate };
  }, [data]);

  // Filtered dataset
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((item) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "PENDING" && !["PENDING", "VERIFIED"].includes(item.status)) return false;
        if (statusFilter === "APPROVED" && item.status !== "APPROVED") return false;
        if (statusFilter === "SUBJECT_TO_REVISION" && !["SUBJECT_TO_REVISION", "REJECTED"].includes(item.status)) return false;
      }
      if (speciesFilter !== "ALL" && item.livestock_type_name !== speciesFilter) {
        return false;
      }
      if (!q) return true;
      return [
        item.transfer_certificate_number,
        item.original_certificate_number,
        item.livestock_tag,
        item.livestock_type_name,
        item.previous_owner_name,
        item.new_owner_name,
        item.municipality,
        item.province,
      ].some((val) => val?.toLowerCase().includes(q));
    });
  }, [data, search, statusFilter, speciesFilter]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Export to CSV for Municipal Auditing
  const handleExportCSV = () => {
    if (!filtered.length) {
      toast.error("No records available to export.");
      return;
    }
    const headers = [
      "Certificate Number",
      "Seller (Previous Owner)",
      "Buyer (New Owner)",
      "Species",
      "Ear Tag / ID",
      "Sex",
      "Age",
      "Transfer Date",
      "Sale Price (PHP)",
      "Municipality Brand",
      "Owner Brand",
      "Origin Location",
      "Destination Location",
      "Status",
      "MAO Remarks",
    ];
    const rows = filtered.map((t) => [
      `"${t.transfer_certificate_number || ""}"`,
      `"${t.previous_owner_name || ""}"`,
      `"${t.new_owner_name || ""}"`,
      `"${t.livestock_type_name || ""}"`,
      `"${t.livestock_tag || ""}"`,
      `"${t.sex_at_transfer || ""}"`,
      `"${t.age_at_transfer || ""}"`,
      `"${t.transfer_date || ""}"`,
      `"${t.purchase_price || ""}"`,
      `"${t.municipality_brand || ""}"`,
      `"${t.owner_brand || ""}"`,
      `"${t.origin_municipality || ""}, ${t.origin_province || ""}"`,
      `"${t.municipality || ""}, ${t.province || ""}"`,
      `"${t.status || ""}"`,
      `"${(t.review_remarks || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MAO_Auction_Ownership_Transfers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Transfer records exported to CSV spreadsheet.");
  };

  return (
    <>
      <PageHeader
        title={isMao ? "Auction Transfer Review" : "Ownership Transfers"}
        subtitle={
          isMao
            ? "Review and approve livestock ownership transfers submitted by the Padre Garcia Auction Market."
            : "Review certificate-backed changes to livestock ownership from municipal sellers."
        }
        variant="admin"
        icon={<ShieldCheck className="size-6 text-[#1E7E34]" />}
        maxWidthClass="w-full"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Validations", href: "/data-validation" },
          { label: "Auction Transfer Review", href: "/ownership-transfers" },
        ]}
      />

      <div className="w-full min-h-[calc(100vh-4.5rem)] nexus-ambient-bg p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Upper Information Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              MUNICIPAL AGRICULTURE OFFICE · PADRE GARCIA
            </span>
            <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
              Transfers from Auction Market
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="h-9 gap-1.5 rounded-xl border-slate-200 bg-white/95 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              title="Refresh records"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin text-emerald-600" : "text-slate-500"}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-9 gap-1.5 rounded-xl border-slate-200 bg-white/95 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              <span>Download Spreadsheet</span>
            </Button>

            <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700 bg-white/95 border border-slate-200/90 rounded-xl px-3 py-2 shadow-2xs">
              <Clock className="size-3.5 text-emerald-600" />
              <span className="tabular-nums font-bold">{clockString || "Loading Manila time…"}</span>
            </div>
          </div>
        </div>

        {/* 4 Bespoke MAO Approval KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Waiting for MAO Approval */}
          <KpiCard
            title="Waiting for Approval"
            variant="amber"
            icon={<Clock className="size-5" />}
            badge={counts.pending > 0 ? "NEEDS REVIEW" : "ALL CLEAR"}
            badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 tracking-wider"
            value={
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {counts.pending.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-amber-800 font-bold">Transfers</span>
              </div>
            }
            description="Transfers waiting for MAO approval"
            isLoading={isLoading}
            wrapText
          />

          {/* KPI 2: Approved by MAO */}
          <KpiCard
            title="Approved"
            variant="emerald"
            icon={<CheckCircle2 className="size-5" />}
            badge={counts.total > 0 ? `${counts.approvalRate}% APPROVED` : "ACTIVE"}
            badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 tracking-wider"
            value={
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {counts.approved.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-emerald-800 font-bold">Approved</span>
              </div>
            }
            description="Ownership officially transferred"
            isLoading={isLoading}
            wrapText
          />

          {/* KPI 3: Returned to Auction */}
          <KpiCard
            title="Returned for Correction"
            variant="rose"
            icon={<RotateCcw className="size-5" />}
            badge={counts.revision > 0 ? "NEEDS CORRECTION" : "NONE"}
            badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 tracking-wider"
            value={
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {counts.revision.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-rose-800 font-bold">Returned</span>
              </div>
            }
            description="Sent back to auction staff for correction"
            isLoading={isLoading}
            wrapText
          />

          {/* KPI 4: Total Auction Submissions */}
          <KpiCard
            title="Total Transfers"
            variant="sky"
            icon={<FileText className="size-5" />}
            badge="TOTAL TRANSFERS"
            badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300 tracking-wider"
            value={
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {counts.total.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-sky-800 font-bold">Total</span>
              </div>
            }
            description="All transfer records received"
            isLoading={isLoading}
            wrapText
          />
        </div>

        {/* MAO Workflow Filter & Search Toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-4 shadow-2xs">
          {/* Status Tabs — PENDING is default */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("PENDING");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "PENDING"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50/80 text-amber-900 border border-amber-200/80 hover:bg-amber-100/70"
              }`}
            >
              <Clock className="size-3.5" />
              <span>Pending Approval</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === "PENDING" ? "bg-white/20 text-white" : "bg-amber-200/80 text-amber-900"
              }`}>
                {counts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("APPROVED");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "APPROVED"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50/80 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100/70"
              }`}
            >
              <Check className="size-3.5" />
              <span>Approved</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === "APPROVED" ? "bg-white/20 text-white" : "bg-emerald-200/80 text-emerald-900"
              }`}>
                {counts.approved}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("SUBJECT_TO_REVISION");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "SUBJECT_TO_REVISION"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "bg-rose-50/80 text-rose-900 border border-rose-200/80 hover:bg-rose-100/70"
              }`}
            >
              <RotateCcw className="size-3.5" />
              <span>Returned</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === "SUBJECT_TO_REVISION" ? "bg-white/20 text-white" : "bg-rose-200/80 text-rose-900"
              }`}>
                {counts.revision}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              All Records ({counts.total})
            </button>
          </div>

          {/* Search Bar & Species Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 lg:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search certificate #, seller, buyer, or tag…"
                className="pl-10 h-9 bg-white border-slate-200 text-xs rounded-xl shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <Select
              value={speciesFilter}
              onValueChange={(val) => {
                setSpeciesFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 sm:w-36 bg-white border-slate-200 text-xs font-semibold rounded-xl shadow-2xs">
                <SelectValue placeholder="All Species" />
              </SelectTrigger>
              <SelectContent>
                {speciesOptions.map((species) => (
                  <SelectItem key={species} value={species} className="text-xs font-medium">
                    {species === "ALL" ? "All Species" : species}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* MAO Decision Table Section */}
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {statusFilter === "PENDING"
                    ? `Transfers Waiting for Approval (${filtered.length})`
                    : statusFilter === "APPROVED"
                    ? `Approved Transfers (${filtered.length})`
                    : statusFilter === "SUBJECT_TO_REVISION"
                    ? `Transfers Returned for Correction (${filtered.length})`
                    : `All Transfer Records (${filtered.length})`}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Municipal Agriculture Office official review of ownership transfers
                </p>
              </div>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
            </span>
          </div>

          {isLoading && (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <RefreshCw className="size-6 animate-spin mx-auto text-emerald-600" />
              <p>Loading transfer records…</p>
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="p-12 text-center space-y-2">
              <FileCheck2 className="size-8 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">
                {statusFilter === "PENDING"
                  ? "All caught up! No transfers are currently waiting for approval."
                  : "No transfer records match your criteria."}
              </p>
              <p className="text-xs text-slate-500">
                {search || speciesFilter !== "ALL"
                  ? "Try resetting your search query or species filter."
                  : "Transfers from the Padre Garcia Auction Market will appear here for review."}
              </p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                  <TableRow>
                    <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3.5">
                      Certificate #
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3.5">
                      Animal Details
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3.5">
                      Seller (Previous Owner)
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3.5">
                      Buyer (New Owner)
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3.5">
                      Transfer Date & Price
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3.5">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3.5 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {paginatedRecords.map((t) => {
                    const isApproved = t.status === "APPROVED";
                    const isRevision = t.status === "SUBJECT_TO_REVISION" || t.status === "REJECTED";
                    const isPending = ["PENDING", "VERIFIED"].includes(t.status);
                    const isActionable = isMao && isPending;

                    return (
                      <TableRow
                        key={t.id}
                        id={`ownership-transfer-${t.id}`}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isPending ? "bg-amber-50/[0.25]" : ""
                        }`}
                      >
                        <TableCell className="py-3.5">
                          <div className="font-mono font-bold text-xs text-slate-900">
                            {t.transfer_certificate_number}
                          </div>
                          {t.original_certificate_number ? (
                            <div className="font-mono text-[10px] text-slate-400">
                              Orig: {t.original_certificate_number}
                            </div>
                          ) : null}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">
                              {t.livestock_type_name || "Livestock"}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-slate-50">
                              {t.livestock_tag || (t.livestock ? `#${t.livestock}` : "External Animal")}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.sex_at_transfer || "—"} · {t.age_at_transfer || "—"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-xs text-slate-900">
                            {t.previous_owner_name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {t.origin_municipality ? `${t.origin_municipality}, ` : ""}
                            {t.origin_province || "Batangas"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-xs text-slate-900">
                            {t.new_owner_name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {t.municipality}, {t.province}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs text-slate-800 font-medium">{t.transfer_date}</div>
                          <div className="font-mono text-[11px] font-bold text-emerald-700">
                            {t.purchase_price ? `₱${Number(t.purchase_price).toLocaleString()}` : "Not recorded"}
                          </div>
                        </TableCell>

                        <TableCell>
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                              <Check className="size-3 stroke-[2.5]" />
                              Approved by MAO
                            </span>
                          ) : isRevision ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECDD3]">
                              <RotateCcw className="size-3 stroke-[2.5]" />
                              Returned for Correction
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending Approval
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isActionable ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={review.isPending}
                                  onClick={() => review.mutate({ id: t.id, status: "APPROVED" })}
                                  className="h-8 px-3 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-2xs gap-1 cursor-pointer transition-all active:scale-95"
                                  title="Approve transfer"
                                >
                                  <Check className="size-3.5" />
                                  <span>Approve</span>
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={review.isPending}
                                  onClick={() => {
                                    setRevisionTarget(t);
                                    setRevisionRemarks("");
                                  }}
                                  className="h-8 px-2.5 text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 rounded-lg shadow-2xs gap-1 cursor-pointer transition-all active:scale-95"
                                  title="Return to auction staff for correction"
                                >
                                  <RotateCcw className="size-3.5" />
                                  <span>Return</span>
                                </Button>
                              </>
                            ) : null}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTransfer(t)}
                              className="h-8 px-2.5 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs gap-1 cursor-pointer"
                              title="View transfer details"
                            >
                              <Eye className="size-3.5 text-slate-500" />
                              <span>View Details</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Table Footer with Pagination */}
          {!isLoading && filtered.length > 0 && totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
              <span className="font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200 bg-white"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200 bg-white"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Municipal Agriculture Office Policy Banner */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 p-4.5 sm:p-5 text-xs text-slate-700 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
            <Building className="size-4 text-emerald-700" />
            <span>About Livestock Ownership Transfers</span>
          </div>
          <p className="leading-relaxed">
            Every livestock ownership transfer recorded by the Padre Garcia Auction Market is sent here for official MAO approval.
            Approving a transfer officially registers the animal under the new owner and marks the seller&apos;s animal as <strong className="text-slate-900 font-bold">SOLD</strong> in their herd inventory.
          </p>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. OFFICIAL MAO CERTIFICATE DETAILS DIALOG                          */}
      {/* =================================================================== */}
      <Dialog open={Boolean(selectedTransfer)} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xl">
          {selectedTransfer && (
            <div className="space-y-6">
              {/* Official Municipal Document Header */}
              <DialogHeader className="border-b border-slate-100 pb-4 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-3 py-0.5 rounded-full tracking-wider">
                    REPUBLIC OF THE PHILIPPINES · MUNICIPALITY OF PADRE GARCIA
                  </span>
                  <Badge variant="outline" className="font-bold text-xs uppercase">
                    {selectedTransfer.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-black text-slate-900 mt-2">
                  Certificate of Livestock Ownership Transfer
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono">
                  Certificate No: #{selectedTransfer.transfer_certificate_number} · Date: {selectedTransfer.transfer_date}
                </DialogDescription>
              </DialogHeader>

              {/* Status Alert Banner */}
              {["PENDING", "VERIFIED"].includes(selectedTransfer.status) ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Waiting for MAO Approval</strong>
                    <span>
                      This transfer was submitted by the Padre Garcia Auction Market and needs MAO approval before the ownership change takes effect.
                    </span>
                  </div>
                </div>
              ) : selectedTransfer.status === "APPROVED" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Officially Approved</strong>
                    <span>
                      This certificate has been approved by the Municipal Agriculture Office. The animal is now officially registered under the new owner.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
                  <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Returned for Correction</strong>
                    <span>Notes for Auction Staff: {selectedTransfer.review_remarks || "Waiting for corrections."}</span>
                  </div>
                </div>
              )}

              {/* Animal Identity & Details */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <Tag className="size-3.5 text-emerald-700" />
                  <span>Animal Information</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Species</span>
                    <strong className="text-slate-900 font-bold">{selectedTransfer.livestock_type_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Ear Tag / ID</span>
                    <strong className="font-mono text-slate-900 font-bold">
                      {selectedTransfer.livestock_tag || (selectedTransfer.livestock ? `#${selectedTransfer.livestock}` : "External Animal")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Sex / Age</span>
                    <strong className="text-slate-900">
                      {selectedTransfer.sex_at_transfer || "—"} / {selectedTransfer.age_at_transfer || "—"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Sale Price</span>
                    <strong className="font-mono text-emerald-700 font-bold">
                      {selectedTransfer.purchase_price ? `₱${Number(selectedTransfer.purchase_price).toLocaleString()}` : "Not recorded"}
                    </strong>
                  </div>
                </div>

                {selectedTransfer.animal_description ? (
                  <div className="text-xs border-t border-slate-200/70 pt-2 text-slate-600">
                    <span className="font-semibold text-slate-700">Animal Description / Markings: </span>
                    {selectedTransfer.animal_description}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-200/70 pt-2">
                  <div>
                    <span className="text-slate-500 text-[11px]">Municipality Brand:</span>{" "}
                    <strong className="text-slate-900">{selectedTransfer.municipality_brand || "None"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Owner Brand:</span>{" "}
                    <strong className="text-slate-900">{selectedTransfer.owner_brand || "None"}</strong>
                  </div>
                </div>
              </div>

              {/* Parties: Seller vs Buyer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Seller */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                  <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider block">
                    Seller (Previous Owner)
                  </span>
                  <div className="font-bold text-sm text-slate-900">{selectedTransfer.previous_owner_name}</div>
                  <div className="text-slate-600 text-[11px]">
                    Origin: {selectedTransfer.origin_municipality || selectedTransfer.municipality},{" "}
                    {selectedTransfer.origin_province || selectedTransfer.province}
                  </div>
                  <div className="text-slate-500 text-[11px] pt-1.5 border-t border-slate-100">
                    Original Certificate:{" "}
                    <strong className="font-mono text-slate-700">
                      {selectedTransfer.original_certificate_number || "None Recorded"}
                    </strong>
                  </div>
                </div>

                {/* Buyer */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                  <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider block">
                    Buyer (New Owner)
                  </span>
                  <div className="font-bold text-sm text-slate-900">{selectedTransfer.new_owner_name}</div>
                  <div className="text-slate-600 text-[11px]">
                    Destination: {selectedTransfer.municipality}, {selectedTransfer.province}
                  </div>
                  <div className="text-slate-500 text-[11px] pt-1.5 border-t border-slate-100">
                    Effective Transfer Date: <strong className="text-slate-700">{selectedTransfer.transfer_date}</strong>
                  </div>
                </div>
              </div>

              {/* Review Remarks if previously returned */}
              {selectedTransfer.review_remarks ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-1">
                  <span className="font-bold block">Previous Notes & Remarks:</span>
                  <p>{selectedTransfer.review_remarks}</p>
                </div>
              ) : null}

              {/* Dialog Footer Actions */}
              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTransfer(null)}
                  className="w-full sm:w-auto text-xs"
                >
                  Close
                </Button>

                {isMao && ["PENDING", "VERIFIED"].includes(selectedTransfer.status) ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={review.isPending}
                      onClick={() => {
                        const target = selectedTransfer;
                        setSelectedTransfer(null);
                        setRevisionTarget(target);
                        setRevisionRemarks("");
                      }}
                      className="flex-1 sm:flex-none text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      Return for Correction
                    </Button>

                    <Button
                      type="button"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: selectedTransfer.id, status: "APPROVED" })}
                      className="flex-1 sm:flex-none text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                    >
                      <Check className="size-3.5 mr-1" />
                      Approve Transfer
                    </Button>
                  </div>
                ) : null}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* 2. RETURN FOR CORRECTION MODAL DIALOG                               */}
      {/* =================================================================== */}
      <Dialog open={Boolean(revisionTarget)} onOpenChange={(open) => !open && setRevisionTarget(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl">
          {revisionTarget && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="size-5 text-rose-600" />
                  <span>Return Transfer to Auction Staff</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Certificate #{revisionTarget.transfer_certificate_number} ·{" "}
                  {revisionTarget.livestock_type_name} ({revisionTarget.previous_owner_name} → {revisionTarget.new_owner_name})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label
                  htmlFor="mao-revision-remarks-input"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  Notes for Auction Staff <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  id="mao-revision-remarks-input"
                  value={revisionRemarks}
                  onChange={(e) => setRevisionRemarks(e.target.value)}
                  placeholder="Explain what needs to be corrected by the auction staff (e.g., ear tag does not match, missing brand markings, wrong sale price)..."
                  rows={4}
                  maxLength={2000}
                  className="text-xs rounded-xl"
                />
                <div className="text-[10px] text-slate-400 text-right">
                  {revisionRemarks.length} / 2000 characters
                </div>
              </div>

              <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRevisionTarget(null);
                    setRevisionRemarks("");
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={review.isPending || !revisionRemarks.trim()}
                  onClick={() =>
                    review.mutate({
                      id: revisionTarget.id,
                      status: "SUBJECT_TO_REVISION",
                      remarks: revisionRemarks.trim(),
                    })
                  }
                  className="text-xs font-bold"
                >
                  Return to Auction Staff
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
