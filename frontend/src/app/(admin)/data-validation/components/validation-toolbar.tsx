"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, CheckCheck, X } from "lucide-react";
import { ValidationStatus } from "../validation-analytics";

interface ValidationToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  barangayFilter: string;
  onBarangayChange: (value: string) => void;
  uniqueBarangays: string[];
  statusFilter: ValidationStatus;
  onStatusChange: (status: ValidationStatus) => void;
  selectedCount: number;
  onBulkAction: () => void;
  onClearSelection: () => void;
}

export function ValidationToolbar({
  searchQuery,
  onSearchChange,
  barangayFilter,
  onBarangayChange,
  uniqueBarangays,
  statusFilter,
  onStatusChange,
  selectedCount,
  onBulkAction,
  onClearSelection,
}: ValidationToolbarProps) {
  return (
    <div className="flex flex-col gap-3 bg-white p-3 sm:p-4 rounded-3xl sm:rounded-[2rem] shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
        {/* Search Box with instant clear button */}
        <div className="relative w-full flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder="Search name, barangay, tag..."
            className="w-full pl-12 pr-10 py-5 sm:py-6 bg-gray-50 border-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] transition-all text-xs sm:text-sm font-medium"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-600 transition-all"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Barangay Filter */}
        <Select value={barangayFilter} onValueChange={onBarangayChange}>
          <SelectTrigger className="w-full sm:w-52 py-5 sm:py-6 bg-gray-50 border-none rounded-2xl text-xs font-bold text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27]">
            <div className="flex items-center gap-2 truncate">
              <MapPin size={16} className="text-gray-400 shrink-0" />
              <SelectValue placeholder="All Barangays" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-gray-100 shadow-xl max-h-64">
            <SelectItem value="ALL" className="rounded-xl text-xs font-bold py-2.5">
              All 18 Barangays
            </SelectItem>
            {uniqueBarangays.map((b) => (
              <SelectItem key={b} value={b} className="rounded-xl text-xs font-medium py-2.5">
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full pt-1">
        {/* Status Filter Tabs (scrollable flex on mobile, flex on desktop) */}
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
          <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1 w-max min-w-full sm:min-w-0 sm:w-auto">
            {(
              [
                { id: "ALL", label: "All", shortLabel: "All" },
                { id: "PENDING", label: "Pending", shortLabel: "Pending" },
                { id: "VERIFIED", label: "Verified by SIBAT", shortLabel: "Verified (SIBAT)" },
                { id: "APPROVED", label: "Approved", shortLabel: "Approved" },
                { id: "REJECTED", label: "Flagged", shortLabel: "Flagged" },
              ] as const
            ).map((item) => {
              const isActive = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStatusChange(item.id as ValidationStatus)}
                  className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all text-center whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? item.id === "VERIFIED"
                        ? "bg-sky-50 text-sky-800 shadow-sm ring-1 ring-sky-200"
                        : "bg-white text-gray-900 shadow-sm"
                      : "text-gray-400 hover:text-gray-700"
                  }`}
                >
                  {item.id === "VERIFIED" && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-sky-500" : "bg-sky-400/60"}`} />
                  )}
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedCount > 0 && (
          <div className="flex items-center justify-between sm:justify-end gap-2 p-2 sm:p-0 bg-green-50/50 sm:bg-transparent rounded-2xl border border-green-100 sm:border-none animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2D5A27] bg-green-100/70 px-3 py-1.5 rounded-xl">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={onBulkAction}
                className="py-4 px-3 sm:px-4 bg-gray-900 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-800 hover:shadow-lg transition-all gap-1.5"
              >
                <CheckCheck size={14} />
                <span>Bulk Action</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClearSelection}
                className="h-8 w-8 sm:h-9 sm:w-9 bg-gray-100 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-all"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
