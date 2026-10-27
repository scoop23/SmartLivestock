"use client";

import { HeaderNotifications } from "@/app/components/header-notifications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { httpError } from "@/lib/http-error";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  BarChart2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  ListFilter,
  MoreVertical,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { OwnershipTransferKpis } from "../ownership-transfer-kpis";

export type Transfer = {
  id: number;
  livestock: number | null;
  livestock_tag: string;
  livestock_type_name: string;
  livestock_operational_status?: string;
  previous_owner_name: string;
  new_owner_name: string;
  transfer_certificate_number: string;
  original_certificate_number: string;
  transfer_date: string;
  purchase_price: string | null;
  status: string;
  municipality: string;
  province: string;
  origin_municipality?: string;
  origin_province?: string;
  animal_description?: string;
  sex_at_transfer?: string;
  age_at_transfer?: string;
  municipality_brand?: string;
  owner_brand?: string;
  heads_count?: number;
};

function getRegistryError(error: unknown) {
  const requestError = httpError(error);
  const status = requestError?.response?.status;
  const detail = requestError?.response?.data?.detail || requestError?.response?.data?.error;
  if (status === 401) return "Your session has expired. Sign in again, then reload this registry.";
  if (status === 403) return "Your account does not have Auction access to these transfer records.";
  if (status && status >= 500)
    return `The server could not load transfer records (HTTP ${status}). Check the backend logs.`;
  if (typeof detail === "string") return detail;
  if (!requestError?.response) return "Could not reach the livestock server. Check that the backend is running.";
  return `Could not load transfer records (HTTP ${status}).`;
}

const statusFilterOptions = [
  { value: "ALL", label: "All statuses" },
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING", label: "Pending Review" },
  { value: "SUBJECT_TO_REVISION", label: "Needs Revision" },
];

export default function AuctionOwnershipTransferRegistryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("Oct 1, 2026 - Oct 27, 2026");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Realtime clock
  const [clock, setClock] = useState({
    date: "Oct 27, 2026",
    time: "7:32 PM",
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock({
        date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // 100% Connected to the live Django REST backend endpoint
  const {
    data: rawData = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["auction-ownership-transfer-registry"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
  });

  // Dynamic monthly distribution derived from real backend data
  const monthlyData = useMemo(() => {
    if (rawData.length === 0) {
      // Empty state default timeline
      return [
        { month: "May", approved: 0, pending: 0, revision: 0 },
        { month: "Jun", approved: 0, pending: 0, revision: 0 },
        { month: "Jul", approved: 0, pending: 0, revision: 0 },
        { month: "Aug", approved: 0, pending: 0, revision: 0 },
        { month: "Sep", approved: 0, pending: 0, revision: 0 },
        { month: "Oct", approved: 0, pending: 0, revision: 0 },
      ];
    }

    const monthMap = new Map<string, { month: string; approved: number; pending: number; revision: number }>();
    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    months.forEach((m) => monthMap.set(m, { month: m, approved: 0, pending: 0, revision: 0 }));

    rawData.forEach((item) => {
      if (!item.transfer_date) return;
      const d = new Date(item.transfer_date);
      const m = d.toLocaleDateString("en-US", { month: "short" });
      const entry = monthMap.get(m) || { month: m, approved: 0, pending: 0, revision: 0 };
      if (item.status === "APPROVED") entry.approved += 1;
      else if (["PENDING", "VERIFIED"].includes(item.status)) entry.pending += 1;
      else entry.revision += 1;
      monthMap.set(m, entry);
    });

    return Array.from(monthMap.values()).slice(-6);
  }, [rawData]);

  // Dynamic species distribution derived from real backend data
  const speciesData = useMemo(() => {
    if (rawData.length === 0) {
      return [
        { name: "Cattle", value: 0, percentage: "0%", color: "#10B981" },
        { name: "Swine", value: 0, percentage: "0%", color: "#F472B6" },
        { name: "Goat", value: 0, percentage: "0%", color: "#FBBF24" },
        { name: "Carabao", value: 0, percentage: "0%", color: "#8B5CF6" },
      ];
    }

    const counts: Record<string, number> = {};
    rawData.forEach((item) => {
      const type = item.livestock_type_name || "Other";
      counts[type] = (counts[type] || 0) + 1;
    });

    const palette = ["#10B981", "#F472B6", "#FBBF24", "#8B5CF6", "#06B6D4", "#64748B"];
    const total = rawData.length;

    return Object.entries(counts).map(([name, count], index) => ({
      name,
      value: count,
      percentage: `${Math.round((count / total) * 100)}%`,
      color: palette[index % palette.length],
    }));
  }, [rawData]);

  // Realtime search & filter query
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawData.filter((item) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "PENDING" && !["PENDING", "VERIFIED"].includes(item.status)) return false;
        if (statusFilter === "APPROVED" && item.status !== "APPROVED") return false;
        if (statusFilter === "SUBJECT_TO_REVISION" && item.status !== "SUBJECT_TO_REVISION") return false;
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
  }, [rawData, search, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filtered.length) {
      toast.error("No records available to export.");
      return;
    }
    const headers = [
      "Certificate Number",
      "Seller",
      "Buyer",
      "Livestock Type",
      "Tag",
      "Transfer Date",
      "Agreed Price",
      "Status",
    ];
    const rows = filtered.map((t) => [
      t.transfer_certificate_number || "",
      `"${t.previous_owner_name || ""}"`,
      `"${t.new_owner_name || ""}"`,
      t.livestock_type_name || "",
      t.livestock_tag || "",
      t.transfer_date || "",
      t.purchase_price || "",
      t.status || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ownership_transfers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Live ownership transfers exported to CSV.");
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Banner Header: Dark Forest Green with Cattle Watermark */}
      <div className="relative overflow-hidden bg-[#073827] text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: `url('/images/species-cattle.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#073827] via-[#0A4530]/95 to-[#073827]/85 pointer-events-none" />

        <div className="relative w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Ownership Transfer Records
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                BACKEND CONNECTED
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/90 font-normal">
              Review live transfer certificates entered by your Auction account and their MAO review status.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refetch()}
              className="size-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer transition-all shadow-xs"
              title="Refresh live backend records"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <HeaderNotifications variant="auction" />
            <div className="flex items-center gap-3 bg-white/10 hover:bg-white/15 transition-colors border border-white/20 rounded-2xl px-4 py-2 text-white shadow-xs backdrop-blur-xs">
              <Calendar className="size-5 text-emerald-200 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold leading-tight tracking-wide">{clock.date}</span>
                <span className="text-[11px] font-medium text-emerald-200/90 leading-tight">{clock.time}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Full-Width Container */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Breadcrumb line & Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Link href="/auction" className="hover:text-slate-800 transition-colors">
              SmartLivestock
            </Link>
            <span className="text-slate-400">/</span>
            <Link href="/auction-ownership-transfers" className="hover:text-slate-800 transition-colors">
              Ownership Transfers
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-slate-900 font-bold">Registry Records</span>
          </div>

          <Button
            asChild
            className="bg-[#0F4A2F] hover:bg-[#0B3D26] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs gap-1.5 active:scale-95 transition-all"
          >
            <Link href="/auction-ownership-transfers">
              <Plus className="size-4" />
              New Transfer
            </Link>
          </Button>
        </div>

        {/* 4 Futuristic KPI Cards (Connected directly to Django REST backend) */}
        <OwnershipTransferKpis records={rawData} isLoading={isLoading} />

        {/* 2 Visual Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Chart: Transfers by Month (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-5 shadow-holo-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <BarChart2 className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Transfers by Month</h2>
                  <p className="text-[11px] text-slate-500">Validation trajectory over past 6 months</p>
                </div>
              </div>
              <Select defaultValue="last6">
                <SelectTrigger className="h-8 w-36 text-xs bg-white border-slate-200 rounded-lg">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last6">Last 6 Months</SelectItem>
                  <SelectItem value="last3">Last 3 Months</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={3} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    domain={[0, "auto"]}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      borderRadius: "12px",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                  <Bar dataKey="approved" name="Approved" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pending Review" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revision" name="Needs Revision" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Legend */}
            <div className="flex items-center justify-center gap-6 pt-1 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#10B981]" />
                <span>Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#FBBF24]" />
                <span>Pending Review</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#F43F5E]" />
                <span>Needs Revision</span>
              </div>
            </div>
          </div>

          {/* Right Chart: Livestock Types Transferred (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-5 shadow-holo-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                  <PieChartIcon className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Livestock Types Transferred</h2>
                  <p className="text-[11px] text-slate-500">Distribution across recorded species</p>
                </div>
              </div>
              <Select defaultValue="thisYear">
                <SelectTrigger className="h-8 w-28 text-xs bg-white border-slate-200 rounded-lg">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisYear">This Year</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              {/* Donut Chart with Center Number */}
              <div className="relative size-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={speciesData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={75}
                      stroke="none"
                      paddingAngle={speciesData.some((s) => s.value > 0) ? 3 : 0}
                    >
                      {speciesData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`${val} transfers`, "Count"]}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: "12px",
                        color: "#FFFFFF",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {rawData.length}
                  </span>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mt-1">
                    Transfers
                  </span>
                </div>
              </div>

              {/* Breakdown Legend List */}
              <div className="flex-1 w-full space-y-2.5 text-xs">
                {speciesData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-700">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <span>{item.value}</span>
                      <span className="text-slate-400 font-normal">({item.percentage})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Search, Filter & Date Range Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search seller, buyer, tag number, or certificate number..."
              className="pl-10 h-10 bg-white/95 backdrop-blur-xs border-slate-200/90 rounded-xl text-xs placeholder:text-slate-400 focus-visible:ring-emerald-500 shadow-holo-card"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-10 sm:w-44 bg-white/95 backdrop-blur-xs border-slate-200/90 rounded-xl text-xs font-semibold shadow-holo-card">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 bg-white/95 backdrop-blur-xs border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-holo-card gap-2 shrink-0"
              >
                <Calendar className="size-4 text-slate-500" />
                <span>{dateFilter}</span>
                <ChevronDown className="size-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onClick={() => setDateFilter("Oct 1, 2026 - Oct 27, 2026")}>
                This Month (Oct 1 - Oct 27)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter("Sep 1, 2026 - Sep 30, 2026")}>
                Last Month (Sep 1 - Sep 30)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter("Jan 1, 2026 - Oct 27, 2026")}>
                Year to Date (2026)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter("All Time")}>
                All Time
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Transfer Records Table Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-holo-card overflow-hidden">
          {/* Card Header */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
                <ListFilter className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Transfer Records ({filtered.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official certificates recorded by your account and synchronized with MAO.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-9 px-3.5 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-xs gap-1.5"
              >
                <Download className="size-3.5 text-slate-500" />
                Export
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-xl text-slate-500 hover:text-slate-800"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => void refetch()}>
                    <RefreshCw className="mr-2 size-3.5" />
                    Sync with backend
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="mr-2 size-3.5" />
                    Export CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Error / Loading Messages */}
          {isError && (
            <div className="p-4">
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription className="flex items-center justify-between">
                  <span>{getRegistryError(error)}</span>
                  <Button size="sm" variant="outline" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {isLoading && (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw className="size-5 animate-spin mx-auto text-emerald-600 mb-2" />
              Connecting to live database and synchronizing transfer records…
            </div>
          )}

          {/* Table */}
          {!isLoading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Certificate #
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Seller
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Buyer
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Animals
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Livestock Type
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Transfer Date
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {paginatedRecords.map((t) => {
                    const isApproved = t.status === "APPROVED";
                    const isRevision = t.status === "SUBJECT_TO_REVISION" || t.status === "REJECTED";
                    const headsDisplay = t.heads_count ? `${t.heads_count} heads` : "1 head";

                    return (
                      <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-mono font-bold text-xs text-slate-900 py-3.5">
                          {t.transfer_certificate_number}
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-slate-800">
                          {t.previous_owner_name}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {t.new_owner_name}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {headsDisplay}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800">
                          {t.livestock_type_name || "Livestock"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {t.transfer_date}
                        </TableCell>
                        <TableCell>
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                              <Check className="size-3 stroke-[2.5]" />
                              Approved
                            </span>
                          ) : isRevision ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECDD3]">
                              <RotateCcw className="size-3 stroke-[2.5]" />
                              Needs Revision
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                              <Clock className="size-3 stroke-[2.5]" />
                              Pending Review
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTransfer(t)}
                              className="h-8 px-2.5 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg gap-1.5 shadow-xs"
                            >
                              <Eye className="size-3.5 text-slate-500" />
                              View
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-lg text-slate-400 hover:text-slate-700"
                                >
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem onClick={() => setSelectedTransfer(t)}>
                                  <Eye className="mr-2 size-3.5" />
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(t.transfer_certificate_number);
                                    toast.success("Certificate number copied!");
                                  }}
                                >
                                  <FileText className="mr-2 size-3.5" />
                                  Copy certificate #
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Empty State when 0 records exist */}
          {!isLoading && filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-500 space-y-3">
              <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
                <FileText className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-slate-900">No ownership transfers recorded yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Transfers entered by your Auction account will automatically synchronize here and update live statistics.
                </p>
              </div>
              <Button asChild size="sm" className="bg-[#0F4A2F] hover:bg-[#0B3D26] text-white font-bold text-xs rounded-xl shadow-xs">
                <Link href="/auction-ownership-transfers">Record First Transfer</Link>
              </Button>
            </div>
          )}

          {/* Table Footer with Pagination */}
          <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} records
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="size-7 rounded-lg border-slate-200 bg-white"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`size-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    currentPage === page
                      ? "bg-[#0F4A2F] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="size-7 rounded-lg border-slate-200 bg-white"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* View Transfer Details Dialog */}
      <Dialog open={Boolean(selectedTransfer)} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
        {selectedTransfer && (
          <DialogContent className="max-w-lg rounded-2xl p-6">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#E3F6EC] text-[#0D6843]">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Transfer Certificate Details
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 font-mono">
                      #{selectedTransfer.transfer_certificate_number}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  variant={selectedTransfer.status === "APPROVED" ? "default" : "outline"}
                  className={
                    selectedTransfer.status === "APPROVED"
                      ? "bg-[#0F4A2F] text-white"
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  }
                >
                  {selectedTransfer.status.replaceAll("_", " ")}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Seller</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedTransfer.previous_owner_name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Buyer</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedTransfer.new_owner_name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Animal</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedTransfer.livestock_type_name} · {selectedTransfer.livestock_tag}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Transfer Date</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedTransfer.transfer_date}</p>
                </div>
                {selectedTransfer.purchase_price && (
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Agreed Price</p>
                    <p className="font-bold text-emerald-800 mt-0.5">
                      ₱{Number(selectedTransfer.purchase_price).toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Location</p>
                  <p className="font-medium text-slate-700 mt-0.5">
                    {selectedTransfer.municipality}, {selectedTransfer.province}
                  </p>
                </div>
              </div>

              {selectedTransfer.original_certificate_number && (
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <p className="text-[11px] text-emerald-800 font-semibold">
                    Original Ownership Certificate
                  </p>
                  <p className="font-mono text-xs font-bold text-emerald-950 mt-0.5">
                    {selectedTransfer.original_certificate_number}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
