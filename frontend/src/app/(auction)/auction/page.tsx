"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Plus,
  Eye,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Calendar,
  MapPin,
  FileSpreadsheet,
  Layers,
  Search,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import {
  InspectionRecord,
  INITIAL_INSPECTIONS,
} from "../auction-inspections/auction-analytics";

export default function AuctionDashboard() {
  const router = useRouter();
  const [inspections] = useState<InspectionRecord[]>(INITIAL_INSPECTIONS);

  const pendingCount = inspections.filter((i) => i.status === "PENDING").length;
  const verifiedCount = inspections.filter((i) => i.status === "VERIFIED").length;
  const approvedCount = inspections.filter((i) => i.status === "APPROVED").length;
  const rejectedCount = inspections.filter((i) => i.status === "REJECTED").length;

  const getStatusBadge = (status: InspectionRecord["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-[10px] uppercase tracking-wider">
            <Clock className="w-3 h-3 mr-1" /> Pending Inspection
          </Badge>
        );
      case "VERIFIED":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-[10px] uppercase tracking-wider">
            <Send className="w-3 h-3 mr-1" /> Verified Today
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved / Cleared
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-bold text-[10px] uppercase tracking-wider">
            <AlertCircle className="w-3 h-3 mr-1" /> Rejected
          </Badge>
        );
    }
  };

  const getPurposeBadge = (purpose: string) => {
    switch (purpose) {
      case "SLAUGHTER":
        return (
          <span className="font-extrabold text-[10px] text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
            Slaughter
          </span>
        );
      case "BREEDING":
        return (
          <span className="font-extrabold text-[10px] text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
            Breeding
          </span>
        );
      case "FATTENING":
        return (
          <span className="font-extrabold text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
            Fattening
          </span>
        );
      default:
        return (
          <span className="font-extrabold text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
            {purpose}
          </span>
        );
    }
  };

  return (
    <>
      <PageHeader
        title="Livestock Auction & Inspection Portal"
        subtitle="Padre Garcia Livestock Market & Slaughterhouse Checkpoint — Batangas"
        variant="auction"
        maxWidthClass="max-w-7xl"
      />

      {/* Market active status banner */}
      <div className="bg-purple-600/95 text-white shadow-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
              <ClipboardCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-extrabold">
                Auction & Meat Inspection Terminal Active — Padre Garcia Livestock Trading Center
              </p>
              <p className="text-[10px] text-purple-100 font-semibold">
                Weekly livestock clearances and transport certifications are synchronized with municipal veterinary health protocols.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => router.push("/auction-inspections")}
            className="bg-white hover:bg-purple-50 text-[#7C3AED] text-xs font-black rounded-xl shadow-md gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Inspection
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* ═══ Compact KPI Cards ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            size="sm"
            title="Pending Inspection"
            value={pendingCount}
            variant="amber"
            icon={<Clock className="w-4 h-4" />}
            badge="Queue"
            description="Awaiting vet inspection"
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="sm"
            title="Verified Today"
            value={verifiedCount}
            variant="sky"
            icon={<Send className="w-4 h-4" />}
            badge="Today"
            description="Clearances processed"
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="sm"
            title="Approved Clearances"
            value={approvedCount}
            variant="emerald"
            icon={<CheckCircle2 className="w-4 h-4" />}
            badge="Cleared"
            description="Permits issued for transit"
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="sm"
            title="Rejected / Flagged"
            value={rejectedCount}
            variant="rose"
            icon={<AlertCircle className="w-4 h-4" />}
            badge="Alert"
            description="Non-compliant records"
            onClick={() => router.push("/auction-inspections")}
          />
        </div>

        {/* ═══ Quick Actions Strip ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            onClick={() => router.push("/auction-inspections")}
            className="border-2 border-purple-100 bg-gradient-to-br from-purple-50/60 via-white to-white hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-purple-100 text-[#7C3AED] group-hover:scale-105 transition-transform shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-[#7C3AED] transition-colors">
                    Issue New Clearance
                  </h3>
                  <p className="text-xs font-medium text-slate-500">Record transport and vet inspection</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition-all shrink-0" />
            </CardContent>
          </Card>

          <Card
            onClick={() => router.push("/auction-inspections")}
            className="border-2 border-slate-100 bg-gradient-to-br from-slate-50/60 via-white to-white hover:border-slate-300 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-slate-100 text-[#1A365D] group-hover:scale-105 transition-transform shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-[#1A365D] transition-colors">
                    Inspection Registry
                  </h3>
                  <p className="text-xs font-medium text-slate-500">Browse and filter all clearance records</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1A365D] group-hover:translate-x-0.5 transition-all shrink-0" />
            </CardContent>
          </Card>

          <Card
            onClick={() => router.push("/auction-announcement")}
            className="border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-white to-white hover:border-emerald-300 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 group-hover:scale-105 transition-transform shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-800 transition-colors">
                    Auction Schedules & News
                  </h3>
                  <p className="text-xs font-medium text-slate-500">Market day schedules and protocols</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* ═══ Recent Inspections Table ═══ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#7C3AED]" />
                Recent Clearance Inspections
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Latest animals inspected for market trade, transport, and slaughter.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/auction-inspections")}
              className="rounded-xl text-xs font-extrabold text-[#7C3AED] hover:bg-purple-50 border-purple-200 gap-1 cursor-pointer"
            >
              View Full Registry <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

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
                      Animals
                    </TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-center">
                      Date
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
                  {inspections.map((record) => {
                    const totalHeads = record.items.reduce(
                      (sum, i) => sum + (Number(i.quantity) || 0),
                      0
                    );
                    return (
                      <TableRow
                        key={record.id}
                        onClick={() => router.push("/auction-inspections")}
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
                          {getPurposeBadge(record.purpose)}
                        </TableCell>

                        {/* Animals */}
                        <TableCell className="text-center py-3.5">
                          <span className="font-extrabold text-xs text-slate-700 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
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
                              router.push("/auction-inspections");
                            }}
                            className="rounded-xl h-8 px-3 text-xs font-extrabold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors shadow-2xs gap-1 cursor-pointer"
                          >
                            View <ChevronRight className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
