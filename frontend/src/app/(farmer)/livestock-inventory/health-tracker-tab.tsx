"use client";

import { useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  Pencil,
  Syringe,
  Filter,
  ArrowUpDown,
  Tag,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LivestockInventoryItem } from "./page";

interface HealthTrackerTabProps {
  inventories: LivestockInventoryItem[];
  isLoading?: boolean;
  onEdit: (item: LivestockInventoryItem) => void;
  onView: (item: LivestockInventoryItem) => void;
}

export default function HealthTrackerTab({
  inventories,
  isLoading = false,
  onEdit,
  onView,
}: HealthTrackerTabProps) {
  const [filterState, setFilterState] = useState<"ALL" | "VACCINATED" | "UNVACCINATED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate Health Telemetry
  const totalHeads = useMemo(
    () => inventories.reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );

  const vaccinatedHeads = useMemo(
    () =>
      inventories
        .filter((i) => Boolean(i.lastVaccinationDate))
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );

  const unvaccinatedHeads = Math.max(0, totalHeads - vaccinatedHeads);
  const vaccinationRate = totalHeads > 0 ? Math.round((vaccinatedHeads / totalHeads) * 100) : 0;

  // Filter pipeline
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return inventories.filter((item) => {
      const hasVax = Boolean(item.lastVaccinationDate);
      if (filterState === "VACCINATED" && !hasVax) return false;
      if (filterState === "UNVACCINATED" && hasVax) return false;

      if (!q) return true;
      return (
        item.tagNumber?.toLowerCase().includes(q) ||
        item.breed?.toLowerCase().includes(q) ||
        item.livestockTypeName?.toLowerCase().includes(q)
      );
    });
  }, [inventories, filterState, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ═══ Executive Health & Biosecurity Strip ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Vaccination Rate Gauge */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-900/90 to-teal-950 text-white border border-emerald-700/30 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Herd Immunization Rate
            </div>
            <span className="text-2xl font-black tabular-nums">{vaccinationRate}%</span>
          </div>

          <div className="my-3">
            <div className="w-full bg-emerald-950/60 h-2.5 rounded-full overflow-hidden border border-emerald-700/40">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${vaccinationRate}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-emerald-100/70 font-medium">
            <strong className="text-white font-bold">{vaccinatedHeads}</strong> of{" "}
            <strong className="text-white font-bold">{totalHeads}</strong> total heads have recorded
            vaccines
          </p>
        </div>

        {/* Card 2: Protected / Vaccinated Headcount */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Vaccinated Animals
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Syringe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 tabular-nums">
              {vaccinatedHeads.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-semibold">heads recorded</span>
          </div>
          <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Up to date protection on file
          </p>
        </div>

        {/* Card 3: Unvaccinated / Needs Verification */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Needs Immunization
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 tabular-nums">
              {unvaccinatedHeads.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 ml-1.5 font-semibold">heads pending</span>
          </div>
          <p className="text-xs text-amber-700 font-semibold mt-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> No vaccine record logged
          </p>
        </div>
      </div>

      {/* ═══ Action & Filter Bar ═══ */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search by tag, breed, or animal type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-50/70 border-slate-200 rounded-xl h-10 text-sm"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2">
          {(
            [
              { id: "ALL", label: "All Animals", count: inventories.length },
              {
                id: "VACCINATED",
                label: "Vaccinated",
                count: inventories.filter((i) => Boolean(i.lastVaccinationDate)).length,
              },
              {
                id: "UNVACCINATED",
                label: "Needs Vaccine",
                count: inventories.filter((i) => !i.lastVaccinationDate).length,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterState(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filterState === t.id
                  ? "bg-emerald-900 text-white border-emerald-900 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t.label} <span className="ml-1 opacity-70 tabular-nums">({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Inventory Health Table ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-700">No matching livestock found</p>
            <p className="text-xs text-slate-400">Try clearing your search query or filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-extrabold text-xs uppercase tracking-wider text-slate-700 py-3.5 pl-5">
                    Animal / Tag
                  </TableHead>
                  <TableHead className="font-extrabold text-xs uppercase tracking-wider text-slate-700 py-3.5">
                    Species & Breed
                  </TableHead>
                  <TableHead className="font-extrabold text-xs uppercase tracking-wider text-slate-700 py-3.5">
                    Entry & Size
                  </TableHead>
                  <TableHead className="font-extrabold text-xs uppercase tracking-wider text-slate-700 py-3.5">
                    Vaccination Status
                  </TableHead>
                  <TableHead className="font-extrabold text-xs uppercase tracking-wider text-slate-700 py-3.5">
                    Last Vaccine Date
                  </TableHead>
                  <TableHead className="font-extrabold text-xs uppercase tracking-wider text-slate-700 py-3.5 text-right pr-5">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.map((item) => {
                  const hasVax = Boolean(item.lastVaccinationDate);
                  return (
                    <TableRow
                      key={item.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Tag / Identity */}
                      <TableCell className="py-3.5 pl-5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              hasVax
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            <Tag className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-black text-sm text-slate-900">
                              {item.entryType === "INDIVIDUAL"
                                ? item.tagNumber || "Un-tagged"
                                : `${item.quantity}x ${item.livestockTypeName} (Batch)`}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400">
                              {item.sex} • {item.weight ? `${item.weight} kg` : "Weight not set"}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Species & Breed */}
                      <TableCell className="py-3.5">
                        <p className="font-bold text-xs text-slate-900">
                          {item.livestockTypeName}
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          {item.breed || "Standard Breed"}
                        </p>
                      </TableCell>

                      {/* Entry Type */}
                      <TableCell className="py-3.5">
                        <Badge
                          variant="outline"
                          className="font-bold text-[11px] rounded-lg border-slate-200 bg-slate-50"
                        >
                          {item.entryType} ({item.quantity} head)
                        </Badge>
                      </TableCell>

                      {/* Vaccination Status Badge */}
                      <TableCell className="py-3.5">
                        {hasVax ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Immunized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            Needs Vaccine
                          </span>
                        )}
                      </TableCell>

                      {/* Last Vaccine Date */}
                      <TableCell className="py-3.5">
                        {hasVax ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            {item.lastVaccinationDate}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No record logged</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3.5 text-right pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(item)}
                            className="rounded-xl h-8 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            Profile
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(item)}
                            className="rounded-xl h-8 px-2.5 text-xs font-bold text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Update
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
      </div>
    </div>
  );
}
