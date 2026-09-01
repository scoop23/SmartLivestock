"use client";

import {
  ClipboardCheck,
  Eye,
  TableIcon,
  LayoutGrid,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { InspectionRecord } from "./auction-analytics";

interface InspectionsListViewProps {
  inspections: InspectionRecord[];
  viewMode: "table" | "card";
  onSelectInspection: (inspection: InspectionRecord) => void;
  getStatusBadge: (status: InspectionRecord["status"]) => React.ReactNode;
}

export function InspectionsListView({
  inspections,
  viewMode,
  onSelectInspection,
  getStatusBadge,
}: InspectionsListViewProps) {
  if (viewMode === "table") {
    return (
      <Card className="border-2 border-slate-200/80 bg-white shadow-xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 pl-5">
                  Control # & Shipper
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5">
                  Destination
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-center">
                  Purpose
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-center">
                  Total Heads
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-center">
                  Date Issued
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-center">
                  Status
                </TableHead>
                <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-right pr-5">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {inspections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center space-y-2">
                      <ClipboardCheck className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">No inspection clearances found</p>
                      <p className="text-xs text-slate-400">Click &ldquo;New Inspection&rdquo; to issue a clearance permit.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                inspections.map((record) => {
                  const totalHeads = record.items.reduce(
                    (sum, i) => sum + (Number(i.quantity) || 0),
                    0
                  );
                  return (
                    <TableRow
                      key={record.id}
                      onClick={() => onSelectInspection(record)}
                      className="cursor-pointer border-b border-slate-100 hover:bg-purple-50/40 transition-colors"
                    >
                      {/* Control Number + Shipper */}
                      <TableCell className="py-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-purple-50 text-[#7C3AED] border border-purple-100/60 shrink-0">
                            <ClipboardCheck className="size-4 text-[#7C3AED]" />
                          </div>
                          <div>
                            <p className="font-black text-sm text-slate-900">{record.shipper_name}</p>
                            <p className="text-[11px] font-semibold text-slate-400 font-mono">
                              {record.control_number}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Destination */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{record.destination}</span>
                        </div>
                      </TableCell>

                      {/* Purpose */}
                      <TableCell className="text-center py-3.5">
                        <Badge variant="outline" className="text-[10px] font-extrabold uppercase">
                          {record.purpose}
                        </Badge>
                      </TableCell>

                      {/* Heads */}
                      <TableCell className="text-center py-3.5">
                        <span className="font-extrabold text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-lg font-mono">
                          {totalHeads} heads
                        </span>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-center py-3.5">
                        <span className="text-xs font-semibold text-slate-500 font-mono">
                          {record.inspection_date}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center py-3.5">
                        {getStatusBadge(record.status)}
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right py-3.5 pr-5">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectInspection(record);
                          }}
                          className="rounded-xl h-8 px-3 text-xs font-extrabold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors shadow-2xs gap-1 cursor-pointer"
                        >
                          View <ChevronRight className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    );
  }

  // ── CARD GRID VIEW ──
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {inspections.map((record) => {
        const totalHeads = record.items.reduce(
          (sum, i) => sum + (Number(i.quantity) || 0),
          0
        );
        return (
          <Card
            key={record.id}
            onClick={() => onSelectInspection(record)}
            className="border border-slate-200 hover:border-purple-300 rounded-2xl bg-white shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer group"
          >
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="bg-[#7C3AED] text-white font-mono text-xs px-2.5 py-0.5 mb-1.5">
                    {record.control_number}
                  </Badge>
                  <h3 className="text-base font-black text-slate-900">{record.shipper_name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" /> {record.destination}
                  </p>
                </div>
                {getStatusBadge(record.status)}
              </div>

              {/* Quick Specs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Animals</span>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{totalHeads} Heads</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Purpose</span>
                  <p className="text-sm font-bold text-slate-700">{record.purpose}</p>
                </div>
              </div>

              {/* Species list preview */}
              <div className="flex flex-wrap gap-1.5">
                {record.items.map((it, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] font-bold bg-white text-slate-700">
                    {it.livestock_type}: {it.quantity} ({it.sex})
                  </Badge>
                ))}
              </div>
            </div>

            <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                Date: {record.inspection_date}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 rounded-xl text-xs font-extrabold text-[#7C3AED] hover:bg-purple-50"
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> View Details
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
