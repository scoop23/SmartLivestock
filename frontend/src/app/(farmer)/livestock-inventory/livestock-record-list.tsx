"use client";

import { useState } from "react";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Pencil,
  Search,
  Tag,
  Trash2,
  Weight,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { LivestockInventoryItem, StatusType } from "./page";

const getStatusBadge = (status: StatusType) => {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Approved
        </Badge>
      );
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 flex items-center gap-1 font-medium">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Pending Review
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200 flex items-center gap-1 font-medium">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          Rejected
        </Badge>
      );
  }
};

interface LivestockRecordListProps {
  items: LivestockInventoryItem[];
  isLoading: boolean;
  livestockTypes?: Record<string, number>;
  onView: (item: LivestockInventoryItem) => void;
  onEdit: (item: LivestockInventoryItem) => void;
  onDelete: (item: LivestockInventoryItem) => void;
}

export default function LivestockRecordList({
  items,
  isLoading,
  livestockTypes,
  onView,
  onEdit,
  onDelete,
}: LivestockRecordListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filtered = items.filter((item) => {
    const matchesSearch =
      item?.tagNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.livestockTypeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchesType = typeFilter === "ALL" || item.livestockTypeName === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by breed, tag number, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-50/50 border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          {livestockTypes && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {Object.entries(livestockTypes).map(([name, id]) => (
                  <SelectItem key={id} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-16 text-emerald-600" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-200">
            <p className="text-slate-500">No livestock records match your query.</p>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card
              key={item.id}
              className="relative overflow-hidden border-2 border-emerald-900/10 bg-emerald-50/30 hover:bg-emerald-50/60 shadow-xs hover:shadow-sm rounded-2xl transition-all duration-200"
            >
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between h-full space-y-3">
                {/* Top Header Row */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="space-y-1.5 flex-1 w-full">
                    {/* Main Title & Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-emerald-950 tracking-tight">
                        {item.entryType === "INDIVIDUAL"
                          ? item.tagNumber || "Un-tagged"
                          : `${item.quantity}x ${item.livestockTypeName} (Batch)`}
                      </h3>

                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900/70 bg-emerald-900/10 px-2 py-0.5 rounded-full">
                        {item.entryType}
                      </span>

                      {getStatusBadge(item.status)}
                    </div>

                    {/* Subtitle */}
                    <p className="text-xs font-semibold text-stone-600">
                      <span className="text-emerald-950 font-bold">
                        {item.livestockTypeName}
                      </span>{" "}
                      • {item.breed || "Standard Breed"} • {item.sex}
                    </p>

                    {/* Slimmer Stats Grid with Inner Depth */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      {/* Weight */}
                      {item.weight && (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                          <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                            <Weight className="w-3.5 h-3.5 text-emerald-900" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Weight</span>
                            <span className="font-extrabold text-emerald-950 truncate leading-tight">{item.weight} kg</span>
                          </div>
                        </div>
                      )}

                      {/* Vaccination */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                        <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-emerald-900" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Vaccinated</span>
                          {item.lastVaccinationDate ? (
                            <span className="font-extrabold text-emerald-950 truncate leading-tight">{item.lastVaccinationDate}</span>
                          ) : (
                            <span className="font-extrabold text-amber-700 truncate leading-tight">No</span>
                          )}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                        <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                          <Tag className="w-3.5 h-3.5 text-emerald-900" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Quantity</span>
                          <span className="font-extrabold text-emerald-950 truncate leading-tight">{item.quantity} head</span>
                        </div>
                      </div>

                      {/* Created Date */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                        <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-emerald-900" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Created</span>
                          <span className="font-extrabold text-emerald-950 truncate leading-tight">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Review Remarks Note */}
                    {item.reviewRemarks && (
                      <div className="mt-2 p-2.5 bg-rose-500/10 border-2 border-rose-900/10 rounded-xl text-xs text-rose-950">
                        <strong className="font-extrabold">Review Note:</strong> {item.reviewRemarks}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 self-end sm:self-start shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(item)}
                      className="rounded-xl h-8 px-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-900/10"
                    >
                      View Details
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(item)}
                      disabled={item.status === "APPROVED"}
                      title={
                        item.status === "APPROVED"
                          ? "Approved entries can no longer be edited"
                          : "Edit entry"
                      }
                      className="rounded-xl text-emerald-950 hover:bg-emerald-900/10 disabled:opacity-30 disabled:cursor-not-allowed h-8 w-8"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(item)}
                      className="rounded-xl text-stone-600 hover:text-rose-600 hover:bg-rose-500/10 h-8 w-8"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
