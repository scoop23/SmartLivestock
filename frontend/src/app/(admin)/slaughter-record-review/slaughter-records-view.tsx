"use client";

import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart2,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Printer,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CarabaoIcon, CattleIcon, HogIcon, MeatIcon } from "./icons";
import { AUGUST_2026_STATS, DailySlaughterSummary, MOCK_DAILY_RECORDS } from "./mock-data";
import { DailySlaughterhousePdfDialog } from "../../(slaughterhouse)/components/daily-slaughterhouse-pdf-dialog";
import { SlaughterDescriptiveAnalytics, type SlaughterRecordData } from "../../(slaughterhouse)/components/slaughter-descriptive-analytics";
import { downloadOfficialReport } from "../reports/report-api";

export type BackendSlaughterRecord = {
  id: number;
  livestock_type: number;
  livestock_type_name: string;
  quantity: number;
  carcass_weight: string | null;
  record_date: string;
  barangay: number | null;
  barangay_name?: string | null;
  status: "PENDING" | "APPROVED" | "SUBJECT_TO_REVISION" | "VERIFIED";
  review_remarks: string;
  created_by_name: string;
  farmer_reported: boolean;
  can_edit: boolean;
  selected_animal_tags?: string[];
  condemned_heads?: number;
  condemned_weight_kg?: string;
  condemnation_reason?: string;
  condemnation_type?: string;
};

interface SlaughterRecordsViewProps {
  onOpenPdfReport?: () => void;
  selectedMonth?: string;
  onSelectedMonthChange?: (month: string) => void;
}

export function SlaughterRecordsView({
  onOpenPdfReport,
  selectedMonth: controlledMonth,
  onSelectedMonthChange,
}: SlaughterRecordsViewProps) {
  const queryClient = useQueryClient();

  // Navigation and filtering states
  const [activeTab, setActiveTab] = useState<"daily" | "monthly" | "reports">("daily");
  const [searchQuery, setSearchQuery] = useState("");
  const [internalMonth, setInternalMonth] = useState("2026-08");
  const selectedMonth = controlledMonth ?? internalMonth;

  const handleMonthChange = (val: string) => {
    if (onSelectedMonthChange) {
      onSelectedMonthChange(val);
    } else {
      setInternalMonth(val);
    }
    setCurrentPage(1);
  };

  const [selectedSpecies, setSelectedSpecies] = useState("ALL");
  const [selectedBarangay, setSelectedBarangay] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected row for details/review dialog
  const [selectedRecord, setSelectedRecord] = useState<DailySlaughterSummary | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Dialog for PDF monthly report (internal fallback)
  const [internalPdfDialogOpen, setInternalPdfDialogOpen] = useState(false);

  // Fetch REAL backend records from Django DRF API
  const recordsQuery = useQuery({
    queryKey: ["slaughterhouse-review-records"],
    queryFn: async () => (await api.get<BackendSlaughterRecord[]>("/production/slaughterhouse/records/")).data,
  });

  const backendRecords = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);

  // Aggregate backend records into daily summaries grouped by date & submitter
  const realDailyRecords: DailySlaughterSummary[] = useMemo(() => {
    if (backendRecords.length === 0) {
      return [];
    }

    const groups = new Map<string, BackendSlaughterRecord[]>();
    backendRecords.forEach((item) => {
      const key = `${item.record_date}_${item.created_by_name || "Abattoir Staff"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    const list: DailySlaughterSummary[] = [];

    groups.forEach((items, key) => {
      const first = items[0];
      const carabaoItems = items.filter((i) => {
        const name = (i.livestock_type_name || "").toLowerCase();
        return name.includes("carabao") || name.includes("buffalo");
      });
      const cattleItems = items.filter((i) => {
        const name = (i.livestock_type_name || "").toLowerCase();
        return name.includes("cattle") || name.includes("cow") || name.includes("bull");
      });
      const hogItems = items.filter((i) => {
        const name = (i.livestock_type_name || "").toLowerCase();
        return name.includes("hog") || name.includes("swine") || name.includes("pig") || name.includes("baboy");
      });

      const carabaoHeads = carabaoItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
      const carabaoKg = carabaoItems.reduce((acc, i) => acc + (Number(i.carcass_weight) || 0), 0);

      const cattleHeads = cattleItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
      const cattleKg = cattleItems.reduce((acc, i) => acc + (Number(i.carcass_weight) || 0), 0);

      const hogsHeads = hogItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
      const hogsKg = hogItems.reduce((acc, i) => acc + (Number(i.carcass_weight) || 0), 0);

      const totalHeads = items.reduce((acc, i) => acc + (i.quantity || 0), 0);

      // Determine overall daily status
      let overallStatus: "APPROVED" | "PENDING" | "SUBJECT_TO_REVISION" = "APPROVED";
      if (items.some((i) => i.status === "SUBJECT_TO_REVISION")) {
        overallStatus = "SUBJECT_TO_REVISION";
      } else if (items.some((i) => i.status === "PENDING")) {
        overallStatus = "PENDING";
      }

      // Format human-readable date
      let formattedDate = first.record_date;
      try {
        const parts = first.record_date.split("-");
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
      } catch {}

      const totalCondemnedHeads = items.reduce((acc, i) => acc + (i.condemned_heads || 0), 0);
      const totalCondemnedKg = items.reduce((acc, i) => acc + Number(i.condemned_weight_kg || 0), 0);
      const reasons = items.map((i) => i.condemnation_reason).filter(Boolean).join("; ");

      list.push({
        id: `daily-${key}`,
        recordIds: items.map((i) => i.id),
        date: formattedDate,
        isoDate: first.record_date,
        farmer: first.created_by_name || "Slaughterhouse Staff",
        barangay: first.barangay_name || "Padre Garcia Abattoir",
        carabao: { heads: carabaoHeads, kg: Math.round(carabaoKg) },
        cattle: { heads: cattleHeads, kg: Math.round(cattleKg) },
        hogs: { heads: hogsHeads, kg: Math.round(hogsKg) },
        totalHeads,
        status: overallStatus,
        remarks: first.review_remarks,
        condemnedHeads: totalCondemnedHeads,
        condemnedKg: totalCondemnedKg,
        condemnationReason: reasons,
      });
    });

    // Sort descending by date
    list.sort((a, b) => b.isoDate.localeCompare(a.isoDate));
    return list;
  }, [backendRecords]);

  // Combined daily records: Real records take priority; fallback to high-fidelity August mock if no real data
  const dailyRecords: DailySlaughterSummary[] = useMemo(() => {
    if (realDailyRecords.length > 0) {
      return realDailyRecords;
    }
    return MOCK_DAILY_RECORDS;
  }, [realDailyRecords]);

  // Available unique months extracted dynamically from real records
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    dailyRecords.forEach((r) => {
      if (r.isoDate && r.isoDate.length >= 7) {
        set.add(r.isoDate.slice(0, 7));
      }
    });
    set.add("2026-08"); // Keep August 2026 as standard
    return Array.from(set).sort().reverse();
  }, [dailyRecords]);

  const formatMonthLabel = (m: string) => {
    if (m === "ALL") return "All Months";
    try {
      const [year, month] = m.split("-");
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return m;
    }
  };

  // Dynamic KPI Metrics calculated from the records for the selected month
  const metrics = useMemo(() => {
    const scopeRecords =
      selectedMonth === "ALL"
        ? dailyRecords
        : dailyRecords.filter((r) => r.isoDate?.startsWith(selectedMonth));

    if (scopeRecords.length === 0) {
      if (selectedMonth === "2026-08") return AUGUST_2026_STATS;
      return { totalSlaughtered: 0, carabaoHeads: 0, carabaoKg: 0, cattleHeads: 0, cattleKg: 0, hogsHeads: 0, hogsKg: 0 };
    }

    const totalSlaughtered = scopeRecords.reduce((sum, r) => sum + r.totalHeads, 0);
    const carabaoHeads = scopeRecords.reduce((sum, r) => sum + r.carabao.heads, 0);
    const carabaoKg = scopeRecords.reduce((sum, r) => sum + r.carabao.kg, 0);
    const cattleHeads = scopeRecords.reduce((sum, r) => sum + r.cattle.heads, 0);
    const cattleKg = scopeRecords.reduce((sum, r) => sum + r.cattle.kg, 0);
    const hogsHeads = scopeRecords.reduce((sum, r) => sum + r.hogs.heads, 0);
    const hogsKg = scopeRecords.reduce((sum, r) => sum + r.hogs.kg, 0);

    return {
      totalSlaughtered,
      carabaoHeads,
      carabaoKg,
      cattleHeads,
      cattleKg,
      hogsHeads,
      hogsKg,
    };
  }, [dailyRecords, selectedMonth]);

  // Available unique barangays from the records
  const availableBarangays = useMemo(() => {
    const set = new Set<string>();
    dailyRecords.forEach((r) => {
      if (r.barangay) set.add(r.barangay);
    });
    return Array.from(set).sort();
  }, [dailyRecords]);

  // Filtering records by Search, Month, Species, Barangay, and Status
  const filteredRecords = useMemo(() => {
    let result = [...dailyRecords];

    // Month filter
    if (selectedMonth !== "ALL") {
      result = result.filter((r) => r.isoDate?.startsWith(selectedMonth));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.farmer.toLowerCase().includes(q) ||
          r.date.toLowerCase().includes(q) ||
          r.barangay.toLowerCase().includes(q)
      );
    }

    // Species filter
    if (selectedSpecies === "CARABAO") {
      result = result.filter((r) => r.carabao.heads > 0);
    } else if (selectedSpecies === "CATTLE") {
      result = result.filter((r) => r.cattle.heads > 0);
    } else if (selectedSpecies === "HOGS") {
      result = result.filter((r) => r.hogs.heads > 0);
    }

    // Barangay filter
    if (selectedBarangay !== "ALL") {
      result = result.filter((r) => r.barangay.toLowerCase() === selectedBarangay.toLowerCase());
    }

    // Status filter
    if (selectedStatus !== "ALL") {
      result = result.filter((r) => r.status.toUpperCase() === selectedStatus);
    }

    return result;
  }, [dailyRecords, selectedMonth, searchQuery, selectedSpecies, selectedBarangay, selectedStatus]);

  // Pagination calculation
  const totalItems = filteredRecords.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + pageSize);

  // Review handler connected directly to the backend database
  const handleReview = async (status: "APPROVED" | "SUBJECT_TO_REVISION") => {
    if (!selectedRecord) return;

    if (status === "SUBJECT_TO_REVISION" && !reviewRemarks.trim()) {
      toast.error("Please enter review remarks to specify needed revisions.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const targetIds = selectedRecord.recordIds || (typeof selectedRecord.id === "number" ? [selectedRecord.id] : []);

      if (targetIds.length > 0) {
        // Execute real review action on the backend for each record in the group
        for (const id of targetIds) {
          await api.post(`/production/slaughterhouse/records/${id}/review/`, {
            status,
            remarks: reviewRemarks.trim(),
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["slaughterhouse-review-records"] });
      }

      toast.success(
        status === "APPROVED"
          ? `Record for ${selectedRecord.farmer} (${selectedRecord.date}) approved.`
          : `Record for ${selectedRecord.farmer} returned for revision.`
      );
      setSelectedRecord(null);
      setReviewRemarks("");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: string } } })?.response?.data;
      toast.error(data?.detail ?? "Could not review slaughter record.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Convert daily records to SlaughterRecordData format for PDF dialog
  const pdfRecords: SlaughterRecordData[] = useMemo(() => {
    if (backendRecords.length > 0) {
      return backendRecords.map((r) => ({
        id: r.id,
        livestock_type: r.livestock_type,
        livestock_type_name: r.livestock_type_name,
        quantity: r.quantity,
        carcass_weight: r.carcass_weight,
        record_date: r.record_date,
        barangay: r.barangay,
        status: r.status,
        review_remarks: r.review_remarks,
        created_by_name: r.created_by_name,
        can_edit: r.can_edit,
        condemned_heads: r.condemned_heads,
        condemned_weight_kg: r.condemned_weight_kg,
        condemnation_reason: r.condemnation_reason,
        condemnation_type: r.condemnation_type,
      }));
    }
    // Fallback list from mock records
    const list: SlaughterRecordData[] = [];
    let counter = 1;
    MOCK_DAILY_RECORDS.forEach((d) => {
      if (d.carabao.heads > 0) {
        list.push({
          id: counter++,
          livestock_type: 4,
          livestock_type_name: "Carabao",
          quantity: d.carabao.heads,
          carcass_weight: String(d.carabao.kg),
          record_date: d.isoDate,
          barangay: 1,
          status: d.status,
          review_remarks: d.remarks || "",
          created_by_name: d.farmer,
          can_edit: false,
        });
      }
      if (d.cattle.heads > 0) {
        list.push({
          id: counter++,
          livestock_type: 1,
          livestock_type_name: "Cattle",
          quantity: d.cattle.heads,
          carcass_weight: String(d.cattle.kg),
          record_date: d.isoDate,
          barangay: 1,
          status: d.status,
          review_remarks: d.remarks || "",
          created_by_name: d.farmer,
          can_edit: false,
        });
      }
      if (d.hogs.heads > 0) {
        list.push({
          id: counter++,
          livestock_type: 2,
          livestock_type_name: "Swine",
          quantity: d.hogs.heads,
          carcass_weight: String(d.hogs.kg),
          record_date: d.isoDate,
          barangay: 1,
          status: d.status,
          review_remarks: d.remarks || "",
          created_by_name: d.farmer,
          can_edit: false,
        });
      }
    });
    return list;
  }, [backendRecords]);

  // Initial month & year numbers for PDF dialog
  const pdfMonthNumber = selectedMonth === "ALL" ? 7 : parseInt(selectedMonth.slice(5, 7), 10) - 1;
  const pdfYearNumber = selectedMonth === "ALL" ? 2026 : parseInt(selectedMonth.slice(0, 4), 10);

  // CSV Export handler with real database records
  const handleExportCsv = () => {
    const headers = [
      "Record ID",
      "Date",
      "Livestock Type",
      "Heads Slaughtered",
      "Carcass Weight (kg)",
      "Submitted By",
      "Status",
      "Barangay",
    ];

    const source = backendRecords.length > 0 ? backendRecords : [];
    let lines: (string | number)[][] = [];

    if (source.length > 0) {
      lines = source
        .filter((r) => selectedMonth === "ALL" || r.record_date.startsWith(selectedMonth))
        .map((r) => [
          r.id,
          r.record_date,
          r.livestock_type_name,
          r.quantity,
          r.carcass_weight ?? "",
          r.created_by_name,
          r.status,
          r.barangay_name ?? "",
        ]);
    } else {
      lines = MOCK_DAILY_RECORDS.map((r) => [
        String(r.id),
        r.date,
        "All Species (Daily Total)",
        r.totalHeads,
        r.carabao.kg + r.cattle.kg + r.hogs.kg,
        r.farmer,
        r.status,
        r.barangay,
      ]);
    }

    const csvContent = [headers.join(","), ...lines.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slaughter-records-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Slaughter records exported to CSV.");
  };

  // Download / View Official Server-side PDF in new tab
  const handleOpenServerPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      toast.loading("Generating official municipal PDF report...", { id: "pdf-load" });
      const year = pdfYearNumber;
      const monthStr = String(pdfMonthNumber + 1).padStart(2, "0");
      const dateFrom = selectedMonth === "ALL" ? `${year}-01-01` : `${year}-${monthStr}-01`;
      const dateTo = selectedMonth === "ALL" ? `${year}-12-31` : `${year}-${monthStr}-28`;

      const res = await downloadOfficialReport(
        "slaughter",
        dateFrom,
        dateTo,
        { species: "", barangay: "", purpose: "", direction: "" },
        "pdf"
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success("Official PDF report opened in new tab.", { id: "pdf-load" });
    } catch {
      toast.dismiss("pdf-load");
      toast.info("Opening official printable abattoir report sheet.");
      if (onOpenPdfReport) onOpenPdfReport();
      else setInternalPdfDialogOpen(true);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* =================================================================== */}
      {/* TOP ACTION BAR: EXPORT RECORDS & VIEW MONTHLY REPORT                */}
      {/* Positioned right-aligned directly above the KPI cards               */}
      {/* =================================================================== */}
      <div className="flex items-center justify-end gap-2.5 sm:gap-3">
        {/* Export Records dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 sm:h-10 gap-1.5 sm:gap-2 rounded-xl border-gray-200 !bg-white bg-white px-3 sm:px-3.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-gray-50"
            >
              <Download className="size-3.5 sm:size-4 text-slate-500" />
              <span>Export Records</span>
              <ChevronDown className="size-3 sm:size-3.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5 shadow-lg !bg-white bg-white border-gray-200">
            <DropdownMenuItem
              onClick={handleExportCsv}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>Export as CSV (.csv)</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                if (onOpenPdfReport) onOpenPdfReport();
                else setInternalPdfDialogOpen(true);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <Printer className="size-4 text-slate-600" />
              <span>View Printable Abattoir Sheet</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-gray-100" />

            <DropdownMenuItem
              disabled={isDownloadingPdf}
              onClick={() => void handleOpenServerPdf()}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <ExternalLink className="size-4 text-rose-600" />
              <span>Open Official Landscape PDF</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Monthly Report button */}
        <Button
          onClick={() => {
            if (onOpenPdfReport) onOpenPdfReport();
            else setInternalPdfDialogOpen(true);
          }}
          className="h-9 sm:h-10 gap-1.5 sm:gap-2 rounded-xl bg-[#1B4D2E] px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#163e25] transition-colors"
        >
          <BarChart3 className="size-3.5 sm:size-4 text-emerald-300" />
          <span>View Monthly Report</span>
        </Button>
      </div>

      {/* =================================================================== */}
      {/* 4 METRIC / KPI CARDS (Connected to Real Data)                       */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Slaughtered */}
        <div className="flex items-center gap-4 rounded-2xl border border-[#D5EEDD] bg-[#F2FAF4] p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6F2DF] text-[#1E7E34]">
            <MeatIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">Total Slaughtered</p>
            <p className="text-2xl font-black tracking-tight text-slate-900">
              {metrics.totalSlaughtered.toLocaleString()} <span className="text-base font-bold">heads</span>
            </p>
            <p className="text-[11px] font-medium text-slate-500">(All species)</p>
          </div>
        </div>

        {/* Card 2: Carabao */}
        <div className="flex items-center gap-4 rounded-2xl border border-[#D0E4FA] bg-[#F4F8FD] p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#DEEDFC] text-[#0284C7]">
            <CarabaoIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">Carabao</p>
            <p className="text-2xl font-black tracking-tight text-slate-900">
              {metrics.carabaoHeads.toLocaleString()} <span className="text-base font-bold">heads</span>
            </p>
            <p className="text-[11px] font-medium text-slate-500">{metrics.carabaoKg.toLocaleString()} kg</p>
          </div>
        </div>

        {/* Card 3: Cattle */}
        <div className="flex items-center gap-4 rounded-2xl border border-[#D5EEDD] bg-[#F2FAF4] p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6F2DF] text-[#16A34A]">
            <CattleIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">Cattle</p>
            <p className="text-2xl font-black tracking-tight text-slate-900">
              {metrics.cattleHeads.toLocaleString()} <span className="text-base font-bold">heads</span>
            </p>
            <p className="text-[11px] font-medium text-slate-500">{metrics.cattleKg.toLocaleString()} kg</p>
          </div>
        </div>

        {/* Card 4: Hogs */}
        <div className="flex items-center gap-4 rounded-2xl border border-[#FAD3DB] bg-[#FDF3F5] p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#FBDDE4] text-[#E11D48]">
            <HogIcon className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">Hogs</p>
            <p className="text-2xl font-black tracking-tight text-slate-900">
              {metrics.hogsHeads.toLocaleString()} <span className="text-base font-bold">heads</span>
            </p>
            <p className="text-[11px] font-medium text-slate-500">{metrics.hogsKg.toLocaleString()} kg</p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABS HEADER                                                         */}
      {/* =================================================================== */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={cn(
              "flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors",
              activeTab === "daily"
                ? "border-[#1B4D2E] text-[#1B4D2E]"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            <Calendar className={cn("size-4", activeTab === "daily" ? "text-[#1B4D2E]" : "text-gray-400")} />
            <span>Daily Records ({totalItems})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={cn(
              "flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors",
              activeTab === "monthly"
                ? "border-[#1B4D2E] text-[#1B4D2E]"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            <BarChart2 className={cn("size-4", activeTab === "monthly" ? "text-[#1B4D2E]" : "text-gray-400")} />
            <span>Monthly Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={cn(
              "flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-colors",
              activeTab === "reports"
                ? "border-[#1B4D2E] text-[#1B4D2E]"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            <FileText className={cn("size-4", activeTab === "reports" ? "text-[#1B4D2E]" : "text-gray-400")} />
            <span>Submitted Reports</span>
          </button>
        </nav>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: DAILY RECORDS (MAIN VIEW WITH REAL DATA)                     */}
      {/* =================================================================== */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          {/* Filters Bar: Stays in a single horizontal row on desktop */}
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by farmer name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-xl border-gray-200 !bg-white bg-white pl-10 pr-9 text-xs sm:text-sm focus:border-emerald-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns in a single clean row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0 shrink-0">
              {/* Dynamic Month Selector */}
              <div className="w-[145px] shrink-0">
                <Select value={selectedMonth} onValueChange={handleMonthChange}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-gray-200 !bg-white bg-white text-xs font-medium shadow-2xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar className="size-3.5 text-gray-500 shrink-0" />
                      <SelectValue placeholder="Month" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">All Months</SelectItem>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {formatMonthLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Species */}
              <div className="w-[125px] shrink-0">
                <Select
                  value={selectedSpecies}
                  onValueChange={(val) => {
                    setSelectedSpecies(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-gray-200 !bg-white bg-white text-xs font-medium shadow-2xs">
                    <SelectValue placeholder="All Species" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">All Species</SelectItem>
                    <SelectItem value="CARABAO">Carabao</SelectItem>
                    <SelectItem value="CATTLE">Cattle</SelectItem>
                    <SelectItem value="HOGS">Hogs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Barangays */}
              <div className="w-[135px] shrink-0">
                <Select
                  value={selectedBarangay}
                  onValueChange={(val) => {
                    setSelectedBarangay(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-gray-200 !bg-white bg-white text-xs font-medium shadow-2xs">
                    <SelectValue placeholder="All Barangays" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">All Barangays</SelectItem>
                    {availableBarangays.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="w-[115px] shrink-0">
                <Select
                  value={selectedStatus}
                  onValueChange={(val) => {
                    setSelectedStatus(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-gray-200 !bg-white bg-white text-xs font-medium shadow-2xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="SUBJECT_TO_REVISION">Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 !bg-white bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  {/* Row 1 Headers */}
                  <tr className="border-b border-gray-200">
                    <th
                      rowSpan={2}
                      className="border-r border-gray-200/80 bg-gray-50/70 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-700"
                    >
                      DATE
                    </th>
                    <th
                      rowSpan={2}
                      className="border-r border-gray-200/80 bg-gray-50/70 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-700"
                    >
                      FARMER / OWNER
                    </th>
                    <th
                      colSpan={2}
                      className="border-r border-gray-200/80 bg-[#E1EFFE] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[#1E3A8A]"
                    >
                      CARABAO
                    </th>
                    <th
                      colSpan={2}
                      className="border-r border-gray-200/80 bg-[#DCFCE7] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[#166534]"
                    >
                      CATTLE
                    </th>
                    <th
                      colSpan={2}
                      className="border-r border-gray-200/80 bg-[#FCE7EB] px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[#9F1239]"
                    >
                      HOGS
                    </th>
                    <th
                      rowSpan={2}
                      className="border-r border-gray-200/80 bg-gray-50/70 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700"
                    >
                      TOTAL HEADS
                    </th>
                    <th
                      rowSpan={2}
                      className="bg-gray-50/70 px-5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700"
                    >
                      ACTIONS
                    </th>
                  </tr>

                  {/* Row 2 Subheaders */}
                  <tr className="border-b border-gray-200">
                    {/* Carabao */}
                    <th className="border-r border-blue-100 bg-[#EFF6FF] px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#1E40AF]">
                      HEADS
                    </th>
                    <th className="border-r border-gray-200/80 bg-[#EFF6FF] px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#1E40AF]">
                      KILOGRAMS
                    </th>
                    {/* Cattle */}
                    <th className="border-r border-green-100 bg-[#F0FDF4] px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#15803D]">
                      HEADS
                    </th>
                    <th className="border-r border-gray-200/80 bg-[#F0FDF4] px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#15803D]">
                      KILOGRAMS
                    </th>
                    {/* Hogs */}
                    <th className="border-r border-rose-100 bg-[#FFF1F2] px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#BE123C]">
                      HEADS
                    </th>
                    <th className="border-r border-gray-200/80 bg-[#FFF1F2] px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#BE123C]">
                      KILOGRAMS
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-sm text-gray-500">
                        No slaughter records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-gray-50/80">
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs sm:text-sm font-medium text-gray-700">
                          {row.date}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs sm:text-sm font-bold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{row.farmer}</span>
                            {row.status === "PENDING" && (
                              <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse" title="Pending review" />
                            )}
                          </div>
                        </td>
                        {/* Carabao */}
                        <td className="px-3 py-3.5 text-center text-xs sm:text-sm font-medium text-gray-800">
                          {row.carabao.heads}
                        </td>
                        <td className="px-3 py-3.5 text-center text-xs sm:text-sm font-medium text-gray-800">
                          {row.carabao.kg.toLocaleString()}
                        </td>
                        {/* Cattle */}
                        <td className="px-3 py-3.5 text-center text-xs sm:text-sm font-medium text-gray-800">
                          {row.cattle.heads}
                        </td>
                        <td className="px-3 py-3.5 text-center text-xs sm:text-sm font-medium text-gray-800">
                          {row.cattle.kg.toLocaleString()}
                        </td>
                        {/* Hogs */}
                        <td className="px-3 py-3.5 text-center text-xs sm:text-sm font-medium text-gray-800">
                          {row.hogs.heads}
                        </td>
                        <td className="px-3 py-3.5 text-center text-xs sm:text-sm font-medium text-gray-800">
                          {row.hogs.kg.toLocaleString()}
                        </td>
                        {/* Total */}
                        <td className="px-4 py-3.5 text-center text-xs sm:text-base font-extrabold text-gray-900">
                          {row.totalHeads}
                        </td>
                        {/* Action */}
                        <td className="whitespace-nowrap px-5 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(row)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-2xs transition-colors hover:bg-gray-100 hover:border-gray-400"
                          >
                            <Eye className="size-3.5 text-gray-600" />
                            <span>View Details</span>
                            <ChevronRight className="size-3 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col items-center justify-between gap-3 px-2 py-2 sm:flex-row">
            <p className="text-xs font-medium text-gray-500">
              Showing {totalItems === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, totalItems)} of{" "}
              {totalItems} daily records
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous Page"
                className="flex size-7 sm:size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="size-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "flex size-7 sm:size-8 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                    page === currentPage
                      ? "bg-[#1B4D2E] text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next Page"
                className="flex size-7 sm:size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: MONTHLY SUMMARY & DESCRIPTIVE ANALYTICS                      */}
      {/* =================================================================== */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          <SlaughterDescriptiveAnalytics
            records={pdfRecords}
            isLoading={recordsQuery.isLoading}
            onRefresh={() => void recordsQuery.refetch()}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: SUBMITTED REPORTS & REVIEW QUEUE                             */}
      {/* =================================================================== */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-emerald-200/80 bg-emerald-50/50 shadow-2xs">
            <CardContent className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Official Municipal Slaughter Submissions
                </p>
                <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                  Facility daily totals transmitted directly to MAO official records. No manual review is required.
                </p>
              </div>
            </CardContent>
          </Card>

          {backendRecords.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
              <h3 className="mt-3 text-sm font-bold text-gray-900">Review queue is clear</h3>
              <p className="mt-1 text-xs text-gray-500">
                All daily abattoir facility submissions and farmer-reported slaughter entries have been reviewed.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-bold uppercase text-gray-600">ID / Date</th>
                    <th className="px-4 py-3 font-bold uppercase text-gray-600">Species</th>
                    <th className="px-4 py-3 font-bold uppercase text-gray-600">Submitted By</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-gray-600">Heads</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-gray-600">Carcass (kg)</th>
                    <th className="px-4 py-3 text-center font-bold uppercase text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right font-bold uppercase text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {backendRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        #{r.id} • {r.record_date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{r.livestock_type_name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.created_by_name}
                        {r.farmer_reported && (
                          <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Farmer
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#1E7E34]">{r.quantity} heads</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">
                        {r.carcass_weight ? `${Number(r.carcass_weight).toLocaleString()} kg` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                            r.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : r.status === "PENDING"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-orange-50 text-orange-700 border-orange-200"
                          )}
                        >
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg text-xs gap-1"
                          onClick={() => {
                            setSelectedRecord({
                              id: r.id,
                              recordIds: [r.id],
                              date: r.record_date,
                              isoDate: r.record_date,
                              farmer: r.created_by_name,
                              barangay: r.barangay_name || "Padre Garcia",
                              carabao: { heads: r.livestock_type_name.toLowerCase().includes("carabao") ? r.quantity : 0, kg: 0 },
                              cattle: { heads: r.livestock_type_name.toLowerCase().includes("cattle") ? r.quantity : 0, kg: 0 },
                              hogs: { heads: r.livestock_type_name.toLowerCase().includes("swine") || r.livestock_type_name.toLowerCase().includes("hog") ? r.quantity : 0, kg: 0 },
                              totalHeads: r.quantity,
                              status: (r.status as "APPROVED" | "PENDING" | "SUBJECT_TO_REVISION") || "APPROVED",
                              remarks: r.review_remarks,
                              condemnedHeads: r.condemned_heads,
                              condemnedKg: Number(r.condemned_weight_kg || 0),
                              condemnationReason: r.condemnation_reason,
                            });
                          }}
                        >
                          <Eye className="size-3.5 text-gray-500" />
                          <span>View</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW DETAILS / REVIEW MODAL DIALOG                                 */}
      {/* =================================================================== */}
      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <MeatIcon className="size-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-gray-900">Daily Slaughter Record Details</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-gray-500">
              Record for <span className="font-semibold text-gray-800">{selectedRecord?.date}</span> • Submitted by{" "}
              <span className="font-semibold text-gray-800">{selectedRecord?.farmer}</span> ({selectedRecord?.barangay})
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 pt-2">
              {/* Species breakdown grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-sky-100 bg-[#F4F8FD] p-3 text-center">
                  <p className="text-[11px] font-semibold text-sky-800">Carabao</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{selectedRecord.carabao.heads} heads</p>
                  <p className="text-[10px] text-slate-500">{selectedRecord.carabao.kg.toLocaleString()} kg</p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-[#F2FAF4] p-3 text-center">
                  <p className="text-[11px] font-semibold text-emerald-800">Cattle</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{selectedRecord.cattle.heads} heads</p>
                  <p className="text-[10px] text-slate-500">{selectedRecord.cattle.kg.toLocaleString()} kg</p>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-[#FDF3F5] p-3 text-center">
                  <p className="text-[11px] font-semibold text-rose-800">Hogs</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{selectedRecord.hogs.heads} heads</p>
                  <p className="text-[10px] text-slate-500">{selectedRecord.hogs.kg.toLocaleString()} kg</p>
                </div>
              </div>

              {/* Total & Status Row */}
              <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-xs">
                <div>
                  <span className="text-gray-500">Total Throughput: </span>
                  <span className="font-black text-gray-900">{selectedRecord.totalHeads} heads</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Status: </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                      selectedRecord.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : selectedRecord.status === "PENDING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-orange-50 text-orange-700 border-orange-200"
                    )}
                  >
                    {selectedRecord.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              {selectedRecord.remarks ? (
                <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                  <span className="font-semibold text-slate-500">Record Notes / Inspection Remarks:</span>
                  <p className="mt-0.5">{selectedRecord.remarks}</p>
                </div>
              ) : null}

              {/* Actions Footer */}
              <DialogFooter className="flex items-center justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRecord(null)}
                  className="rounded-xl border-gray-200 text-xs font-bold"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* OFFICIAL MONTHLY REPORT PDF DIALOG (Internal fallback)             */}
      {/* =================================================================== */}
      {!onOpenPdfReport && (
        <DailySlaughterhousePdfDialog
          open={internalPdfDialogOpen}
          onOpenChange={setInternalPdfDialogOpen}
          records={pdfRecords}
          loading={recordsQuery.isLoading}
          initialMonth={pdfMonthNumber}
          initialYear={pdfYearNumber}
        />
      )}
    </div>
  );
}
