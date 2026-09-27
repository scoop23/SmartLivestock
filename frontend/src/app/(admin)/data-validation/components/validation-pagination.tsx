"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ValidationPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function ValidationPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: ValidationPaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs mt-3">
      {/* ── Left: Items Range Telemetry & Page Size ── */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <p className="text-xs text-slate-500 font-medium">
          Showing{" "}
          <strong className="text-slate-900 font-bold font-mono">
            {startItem}-{endItem}
          </strong>{" "}
          of{" "}
          <strong className="text-slate-900 font-bold font-mono">
            {totalItems}
          </strong>{" "}
          records
        </p>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-[11px] font-medium hidden md:inline text-slate-400">
              Per page:
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onPageSizeChange(size)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono transition-all ${
                    pageSize === size
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Navigation Controls ── */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
        {/* First Page */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
          title="First page"
        >
          <ChevronsLeft className="size-4" />
        </Button>

        {/* Previous Page */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 gap-1 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        {/* Page Number Pills (Desktop / Tablet) */}
        <div className="hidden xs:flex items-center gap-1 px-1">
          {pageNumbers.map((page, idx) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-xs text-slate-400 font-mono select-none"
                >
                  &hellip;
                </span>
              );
            }

            const isCurrent = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={isCurrent ? "page" : undefined}
                className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold font-mono transition-all ${
                  isCurrent
                    ? "bg-[#2D5A27] text-white shadow-2xs font-black ring-1 ring-[#2D5A27]"
                    : "bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Mobile Page Indicator Pill */}
        <div className="xs:hidden px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-black font-mono text-slate-800 border border-slate-200">
          {currentPage} / {totalPages}
        </div>

        {/* Next Page */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 gap-1 disabled:opacity-30 disabled:pointer-events-none"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-3.5" />
        </Button>

        {/* Last Page */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
          title="Last page"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
