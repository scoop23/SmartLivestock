"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  CheckCheck,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  Skull,
  Stethoscope,
  X,
} from "lucide-react";
import { ValidationStatus } from "../validation-analytics";

const STATUS_FILTERS = [
  { id: "ALL", label: "All Records", dotClass: "bg-slate-400" },
  { id: "PENDING", label: "Awaiting SIBAT", dotClass: "bg-amber-500" },
  { id: "AWAITING_MAO", label: "Awaiting MAO", dotClass: "bg-indigo-500" },
  { id: "VERIFIED", label: "SIBAT Verified", dotClass: "bg-sky-500" },
  { id: "APPROVED", label: "MAO Approved", dotClass: "bg-emerald-500" },
  { id: "SUBJECT_TO_REVISION", label: "Revision Required", dotClass: "bg-rose-500" },
] as const;

const INCIDENT_TYPE_FILTERS = [
  { id: "ALL", label: "All Declarations" },
  { id: "disease", label: "Disease Outbreaks" },
  { id: "mortality", label: "Mortality Records" },
  { id: "inspection", label: "Inspections" },
] as const;

interface ValidationToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  barangayFilter: string;
  onBarangayChange: (value: string) => void;
  uniqueBarangays: string[];
  statusFilter: ValidationStatus;
  onStatusChange: (status: ValidationStatus) => void;
  incidentTypeFilter?: string;
  onIncidentTypeChange?: (type: string) => void;
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
  incidentTypeFilter,
  onIncidentTypeChange,
  selectedCount,
  onBulkAction,
  onClearSelection,
}: ValidationToolbarProps) {
  const currentStatus =
    STATUS_FILTERS.find((item) => item.id === statusFilter) ?? STATUS_FILTERS[0];

  const currentIncidentType =
    INCIDENT_TYPE_FILTERS.find((item) => item.id === incidentTypeFilter) ??
    INCIDENT_TYPE_FILTERS[0];

  return (
    <div className="flex flex-col gap-2.5 bg-white p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full flex-wrap lg:flex-nowrap">
        {/* Search Box with instant clear button */}
        <div className="relative w-full flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <Input
            type="text"
            placeholder="Search name, barangay, tag..."
            className="w-full pl-11 pr-10 py-5 sm:py-5.5 bg-gray-50 border-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] transition-all text-xs sm:text-sm font-medium"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-600 transition-all cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Incident Type Filter Dropdown (visible only on Field Declarations) */}
        {onIncidentTypeChange && (
          <Select
            value={incidentTypeFilter ?? "ALL"}
            onValueChange={onIncidentTypeChange}
          >
            <SelectTrigger className="w-full sm:w-44 lg:w-48 py-5 sm:py-5.5 bg-gray-50 border-none rounded-2xl text-xs font-bold text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] cursor-pointer">
              <div className="flex items-center gap-2 truncate">
                {currentIncidentType.id === "disease" && (
                  <Stethoscope size={15} className="text-amber-600 shrink-0" />
                )}
                {currentIncidentType.id === "mortality" && (
                  <Skull size={15} className="text-rose-600 shrink-0" />
                )}
                {currentIncidentType.id === "inspection" && (
                  <ShieldCheck size={15} className="text-purple-600 shrink-0" />
                )}
                {currentIncidentType.id === "ALL" && (
                  <Activity size={15} className="text-gray-400 shrink-0" />
                )}
                <span className="truncate">{currentIncidentType.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-gray-100 shadow-xl max-h-64">
              {INCIDENT_TYPE_FILTERS.map((item) => (
                <SelectItem
                  key={item.id}
                  value={item.id}
                  className="rounded-xl text-xs font-bold py-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {item.id === "disease" && (
                      <Stethoscope size={14} className="text-amber-600 shrink-0" />
                    )}
                    {item.id === "mortality" && (
                      <Skull size={14} className="text-rose-600 shrink-0" />
                    )}
                    {item.id === "inspection" && (
                      <ShieldCheck size={14} className="text-purple-600 shrink-0" />
                    )}
                    {item.id === "ALL" && (
                      <Activity size={14} className="text-slate-400 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status Filter Dropdown */}
        <Select
          value={statusFilter}
          onValueChange={(val) => onStatusChange(val as ValidationStatus)}
        >
          <SelectTrigger className="w-full sm:w-44 lg:w-48 py-5 sm:py-5.5 bg-gray-50 border-none rounded-2xl text-xs font-bold text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] cursor-pointer">
            <div className="flex items-center gap-2 truncate">
              <Filter size={15} className="text-gray-400 shrink-0" />
              <span className={`size-2 rounded-full shrink-0 ${currentStatus.dotClass}`} />
              <span className="truncate">{currentStatus.label}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-gray-100 shadow-xl max-h-64">
            {STATUS_FILTERS.map((item) => (
              <SelectItem
                key={item.id}
                value={item.id}
                className="rounded-xl text-xs font-bold py-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full shrink-0 ${item.dotClass}`} />
                  <span>{item.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Barangay Filter Dropdown */}
        <Select value={barangayFilter} onValueChange={onBarangayChange}>
          <SelectTrigger className="w-full sm:w-44 lg:w-48 py-5 sm:py-5.5 bg-gray-50 border-none rounded-2xl text-xs font-bold text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] cursor-pointer">
            <div className="flex items-center gap-2 truncate">
              <MapPin size={15} className="text-gray-400 shrink-0" />
              <SelectValue placeholder="All Barangays" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-gray-100 shadow-xl max-h-64">
            <SelectItem value="ALL" className="rounded-xl text-xs font-bold py-2.5 cursor-pointer">
              All 18 Barangays
            </SelectItem>
            {uniqueBarangays.map((b) => (
              <SelectItem key={b} value={b} className="rounded-xl text-xs font-medium py-2.5 cursor-pointer">
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Controls */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between sm:justify-end gap-2 p-2 sm:p-2.5 bg-green-50/50 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#2D5A27] bg-green-100/70 px-3 py-1.5 rounded-xl">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={onBulkAction}
              className="py-3.5 px-3 sm:px-4 bg-gray-900 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-800 hover:shadow-lg transition-all gap-1.5 cursor-pointer"
            >
              <CheckCheck size={14} />
              <span>Bulk Action</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClearSelection}
              className="h-8 w-8 sm:h-9 sm:w-9 bg-gray-100 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-all cursor-pointer"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
