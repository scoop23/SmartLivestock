"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Printer, FileText } from "lucide-react";
import type { SlaughterRecordData } from "./slaughter-descriptive-analytics";

interface DailySlaughterhousePdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: SlaughterRecordData[];
  loading: boolean;
}

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export function DailySlaughterhousePdfDialog({
  open,
  onOpenChange,
  records,
  loading,
}: DailySlaughterhousePdfDialogProps) {
  const currentDate = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState<{ month: number; year: number } | null>(null);
  const approvedRecords = useMemo(
    () => records.filter((record) => record.status === "APPROVED"),
    [records],
  );
  const latestApprovedDate = useMemo(
    () => approvedRecords.map((record) => record.record_date).filter(Boolean).sort().at(-1),
    [approvedRecords],
  );
  const selectedMonth = selectedPeriod?.month ?? (latestApprovedDate ? Number(latestApprovedDate.slice(5, 7)) - 1 : currentDate.getMonth());
  const selectedYear = selectedPeriod?.year ?? (latestApprovedDate ? Number(latestApprovedDate.slice(0, 4)) : currentDate.getFullYear());
  const [signatoryName, setSignatoryName] = useState("REYMEL CORONEL");
  const [signatoryTitle, setSignatoryTitle] = useState("SLAUGHTERHOUSE MASTER II");

  // Determine days in selected month (e.g., 28, 29, 30, or 31)
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Aggregate daily records by day (1..31) and species (Carabao, Cattle, Hogs/Swine)
  const reportData = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

    // Structure for 31 days
    const dailyRows: Array<{
      day: number;
      carabao: { heads: number; kilograms: number };
      cattle: { heads: number; kilograms: number };
      hogs: { heads: number; kilograms: number };
    }> = [];

    for (let d = 1; d <= 31; d++) {
      dailyRows.push({
        day: d,
        carabao: { heads: 0, kilograms: 0 },
        cattle: { heads: 0, kilograms: 0 },
        hogs: { heads: 0, kilograms: 0 },
      });
    }

    // Filter relevant records for the month
    approvedRecords.forEach((rec) => {
      if (!rec.record_date || !rec.record_date.startsWith(monthPrefix)) return;

      const dayNumber = parseInt(rec.record_date.slice(8, 10), 10);
      if (dayNumber < 1 || dayNumber > 31) return;

      const rowIndex = dayNumber - 1;
      const typeLower = (rec.livestock_type_name || "").toLowerCase();
      const heads = rec.quantity || 0;
      const kg = rec.carcass_weight ? parseFloat(rec.carcass_weight) || 0 : 0;

      if (typeLower.includes("carabao") || typeLower.includes("buffalo")) {
        dailyRows[rowIndex].carabao.heads += heads;
        dailyRows[rowIndex].carabao.kilograms += kg;
      } else if (typeLower.includes("cattle") || typeLower.includes("cow") || typeLower.includes("bull")) {
        dailyRows[rowIndex].cattle.heads += heads;
        dailyRows[rowIndex].cattle.kilograms += kg;
      } else if (
        typeLower.includes("hog") ||
        typeLower.includes("swine") ||
        typeLower.includes("pig") ||
        typeLower.includes("baboy")
      ) {
        dailyRows[rowIndex].hogs.heads += heads;
        dailyRows[rowIndex].hogs.kilograms += kg;
      }
    });

    // Compute column totals
    const totals = dailyRows.reduce(
      (acc, r) => {
        acc.carabao.heads += r.carabao.heads;
        acc.carabao.kilograms += r.carabao.kilograms;
        acc.cattle.heads += r.cattle.heads;
        acc.cattle.kilograms += r.cattle.kilograms;
        acc.hogs.heads += r.hogs.heads;
        acc.hogs.kilograms += r.hogs.kilograms;
        return acc;
      },
      {
        carabao: { heads: 0, kilograms: 0 },
        cattle: { heads: 0, kilograms: 0 },
        hogs: { heads: 0, kilograms: 0 },
      }
    );

    return { dailyRows, totals };
  }, [approvedRecords, selectedYear, selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const monthName = MONTH_NAMES[selectedMonth];
    const headers = [
      "DATE",
      "CARABAO_HEADS",
      "CARABAO_KILOGRAMS",
      "CATTLE_HEADS",
      "CATTLE_KILOGRAMS",
      "HOGS_HEADS",
      "HOGS_KILOGRAMS",
    ];

    const lines = reportData.dailyRows
      .filter((r) => r.day <= daysInMonth)
      .map((r) => [
        r.day,
        r.carabao.heads || "",
        r.carabao.kilograms ? r.carabao.kilograms.toFixed(2) : "",
        r.cattle.heads || "",
        r.cattle.kilograms ? r.cattle.kilograms.toFixed(2) : "",
        r.hogs.heads || "",
        r.hogs.kilograms ? r.hogs.kilograms.toFixed(2) : "",
      ].join(","));

    lines.push([
      "TOTAL",
      reportData.totals.carabao.heads,
      reportData.totals.carabao.kilograms.toFixed(2),
      reportData.totals.cattle.heads,
      reportData.totals.cattle.kilograms.toFixed(2),
      reportData.totals.hogs.heads,
      reportData.totals.hogs.kilograms.toFixed(2),
    ].join(","));

    const csvContent = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DAILY_SLAUGHTERHOUSE_REPORT_${monthName}_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96dvh] max-w-4xl overflow-y-auto p-4 sm:p-6 print:p-0 print:border-none print:shadow-none print:max-h-none print:max-w-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-rose-600" />
            Padre Garcia Municipal Slaughterhouse — Official Monthly PDF Report
          </DialogTitle>
          <DialogDescription>
            Form replicates the official standard Local Government Economic Enterprise municipal report sheet.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => setSelectedPeriod({ month: parseInt(val, 10), year: selectedYear })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, idx) => (
                    <SelectItem key={name} value={String(idx)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-24">
              <Input
                type="number"
                min={2020}
                max={2035}
                value={selectedYear}
                onChange={(e) => setSelectedPeriod({ month: selectedMonth, year: parseInt(e.target.value, 10) || selectedYear })}
                className="h-9"
              />
            </div>

            <div className="w-48">
              <Input
                type="text"
                placeholder="Signatory Name"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <p className="w-full text-[11px] text-slate-500" role="status">
              {loading
                ? "Loading approved slaughter records…"
                : "Prefilled from approved slaughter records. The latest month with approved data is selected automatically."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={loading} className="h-9 text-xs">
              <Download className="mr-1.5 size-3.5" />
              CSV
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={loading} className="h-9 bg-rose-700 hover:bg-rose-800 text-xs">
              <Printer className="mr-1.5 size-3.5" />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PRINTABLE OFFICIAL REPORT SHEET (EXACT REPLICA OF PHYSICAL PAPER)   */}
        {/* =================================================================== */}
        <div
          id="daily-slaughterhouse-report-sheet"
          className="mx-auto w-full max-w-[760px] rounded-sm bg-white p-6 text-black shadow-sm print:p-2 print:shadow-none font-serif text-[11px] leading-tight"
        >
          {/* Official Document Header */}
          <div className="relative mb-3 flex items-center justify-between border-b pb-2">
            {/* Batangas Seal */}
            <div className="flex h-16 w-16 items-center justify-center">
              <Image
                src="/images/batangas-seal.png"
                alt="Province of Batangas Seal"
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                unoptimized
              />
            </div>

            {/* Central Typography */}
            <div className="text-center font-serif leading-snug">
              <p className="text-[10px] tracking-wider uppercase font-semibold">
                Republic of the Philippines
              </p>
              <p className="text-[11px] font-bold tracking-wide uppercase">
                Province of Batangas
              </p>
              <p className="text-[12px] font-black tracking-wide uppercase">
                Municipality of Padre Garcia
              </p>
              <p className="text-[10px] italic font-semibold text-slate-800">
                LOCAL GOVERNMENT ECONOMIC ENTERPRISE
              </p>
              <p className="text-[12px] font-extrabold tracking-wider uppercase text-slate-950 mt-0.5">
                PADRE GARCIA MUNICIPAL SLAUGHTERHOUSE
              </p>
            </div>

            {/* Padre Garcia Seal */}
            <div className="flex h-16 w-16 items-center justify-center">
              <Image
                src="/images/padre-garcia-seal.png"
                alt="Municipality of Padre Garcia Seal"
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                unoptimized
              />
            </div>
          </div>

          {/* Document Title */}
          <div className="my-2 text-center">
            <h1 className="text-[13px] font-black tracking-wider uppercase underline underline-offset-2">
              DAILY SLAUGHTERHOUSE REPORT
            </h1>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide">
              FOR THE MONTH OF{" "}
              <span className="font-extrabold text-[12px] underline">
                {MONTH_NAMES[selectedMonth]}
              </span>{" "}
              {selectedYear}
            </p>
          </div>

          {/* Report Data Table */}
          <table className="w-full border-collapse border-2 border-black text-center text-[10px]">
            <thead>
              <tr className="border-b-2 border-black">
                <th
                  rowSpan={2}
                  className="w-12 border-r border-black p-1 font-bold uppercase tracking-wider"
                >
                  DATE
                </th>
                <th
                  colSpan={2}
                  className="border-r border-black p-1 font-bold uppercase tracking-wider bg-slate-50/50"
                >
                  CARABAO
                </th>
                <th
                  colSpan={2}
                  className="border-r border-black p-1 font-bold uppercase tracking-wider bg-slate-50/50"
                >
                  CATTLE
                </th>
                <th
                  colSpan={2}
                  className="p-1 font-bold uppercase tracking-wider bg-slate-50/50"
                >
                  HOGS
                </th>
              </tr>
              <tr className="border-b-2 border-black font-semibold text-[9px]">
                <th className="w-16 border-r border-black p-0.5">HEADS</th>
                <th className="w-24 border-r border-black p-0.5">KILOGRAMS</th>
                <th className="w-16 border-r border-black p-0.5">HEADS</th>
                <th className="w-24 border-r border-black p-0.5">KILOGRAMS</th>
                <th className="w-16 border-r border-black p-0.5">HEADS</th>
                <th className="w-24 p-0.5">KILOGRAMS</th>
              </tr>
            </thead>
            <tbody>
              {reportData.dailyRows.map((row) => {
                const isOutOfMonth = row.day > daysInMonth;
                return (
                  <tr
                    key={row.day}
                    className={`border-b border-black/80 hover:bg-slate-50 ${
                      isOutOfMonth ? "bg-slate-100/50 text-slate-400" : ""
                    }`}
                  >
                    <td className="border-r border-black p-0.5 font-bold">{row.day}</td>
                    {/* Carabao */}
                    <td className="border-r border-black p-0.5 font-sans font-medium">
                      {row.carabao.heads > 0 ? row.carabao.heads : ""}
                    </td>
                    <td className="border-r border-black p-0.5 font-sans font-medium">
                      {row.carabao.kilograms > 0
                        ? Math.round(row.carabao.kilograms).toLocaleString()
                        : ""}
                    </td>
                    {/* Cattle */}
                    <td className="border-r border-black p-0.5 font-sans font-medium">
                      {row.cattle.heads > 0 ? row.cattle.heads : ""}
                    </td>
                    <td className="border-r border-black p-0.5 font-sans font-medium">
                      {row.cattle.kilograms > 0
                        ? Math.round(row.cattle.kilograms).toLocaleString()
                        : ""}
                    </td>
                    {/* Hogs */}
                    <td className="border-r border-black p-0.5 font-sans font-medium">
                      {row.hogs.heads > 0 ? row.hogs.heads : ""}
                    </td>
                    <td className="p-0.5 font-sans font-medium">
                      {row.hogs.kilograms > 0
                        ? Math.round(row.hogs.kilograms).toLocaleString()
                        : ""}
                    </td>
                  </tr>
                );
              })}

              {/* Total Summary Row */}
              <tr className="border-t-2 border-black bg-slate-100/80 font-bold text-[10px]">
                <td className="border-r border-black p-1 text-center font-black">TOTAL</td>
                <td className="border-r border-black p-1 font-sans font-black">
                  {reportData.totals.carabao.heads.toLocaleString()}
                </td>
                <td className="border-r border-black p-1 font-sans font-black">
                  {Math.round(reportData.totals.carabao.kilograms).toLocaleString()}
                </td>
                <td className="border-r border-black p-1 font-sans font-black">
                  {reportData.totals.cattle.heads.toLocaleString()}
                </td>
                <td className="border-r border-black p-1 font-sans font-black">
                  {Math.round(reportData.totals.cattle.kilograms).toLocaleString()}
                </td>
                <td className="border-r border-black p-1 font-sans font-black">
                  {reportData.totals.hogs.heads.toLocaleString()}
                </td>
                <td className="p-1 font-sans font-black">
                  {Math.round(reportData.totals.hogs.kilograms).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatory Footer */}
          <div className="mt-8 flex justify-end font-serif">
            <div className="w-64 text-center">
              <p className="text-left text-[10px] font-bold uppercase mb-4">PREPARED BY:</p>
              <p className="font-black uppercase tracking-wider text-[11px] underline">
                {signatoryName}
              </p>
              <p className="text-[10px] font-bold uppercase text-slate-800">
                {signatoryTitle}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint} disabled={loading} className="bg-rose-700 hover:bg-rose-800">
            <Printer className="mr-2 size-4" />
            Print Official Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
