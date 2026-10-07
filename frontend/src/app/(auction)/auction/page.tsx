"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CheckCircle2,
  RotateCcw,
  Clock,
  Send,
  Plus,
  ChevronRight,
  ArrowRight,
  MapPin,
  Map,
  QrCode,
  Loader2,
  Megaphone,
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
  fetchInspections,
} from "../auction-inspections/auction-analytics";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import { InspectionDetailsDialog } from "../auction-inspections/inspection-details-dialog";

export default function AuctionDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);

  const { data: inspections = [], isLoading, isError } = useQuery<InspectionRecord[]>({
    queryKey: ["inspections"],
    queryFn: () => fetchInspections(),
    staleTime: 30_000,
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["inspections"] });
  };

  const pendingCount = inspections.filter((i) => i.status === "PENDING").length;
  const verifiedCount = inspections.filter((i) => i.status === "VERIFIED").length;
  const approvedCount = inspections.filter((i) => i.status === "APPROVED").length;
  const revisionCount = inspections.filter(
    (i) => i.status === "SUBJECT_TO_REVISION" || i.status === "REJECTED"
  ).length;

  const getStatusBadge = (status: InspectionRecord["status"], record?: InspectionRecord) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] uppercase tracking-wider">
            <Clock className="w-3 h-3 mr-1" /> {record?.created_by_role === "FARMER" ? "Awaiting Auction Submission" : "Pending MAO Review"}
          </Badge>
        );
      case "VERIFIED":
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-bold text-[10px] uppercase tracking-wider">
            <Send className="w-3 h-3 mr-1" /> Submitted to MAO
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved / Cleared
          </Badge>
        );
      case "SUBJECT_TO_REVISION":
      case "REJECTED":
        return (
          <Badge className="bg-amber-100 text-amber-950 border-amber-400 font-bold text-[10px] uppercase tracking-wider">
            <RotateCcw className="w-3 h-3 mr-1" /> Subject to Revision
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
        title="Livestock Auction Movement Portal"
        subtitle="Padre Garcia Livestock Market & Slaughterhouse Checkpoint — Batangas"
        variant="auction"
        maxWidthClass="w-full"
      />

      {/* Market active status banner */}
      <div className="bg-purple-700 text-white shadow-xs">
        <div className="w-full px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
              <ClipboardCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black">
                Auction Livestock Intake Active — Padre Garcia Livestock Trading Center
              </p>
              <p className="text-[10px] text-purple-100 font-semibold">
                Auction records are submitted to MAO for official review and clearance decisions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsScannerOpen(true)}
              className="bg-purple-900/80 hover:bg-purple-900 text-white border border-purple-300/30 text-xs font-bold rounded-xl shadow-xs gap-1.5 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              Scan Gate QR Pass
            </Button>

            <Button
              size="sm"
              onClick={() => router.push("/auction-inspections/new")}
              className="bg-white hover:bg-purple-50 text-[#7C3AED] text-xs font-black rounded-xl shadow-md gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Movement Log
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 w-full space-y-6">
        {/* ═══ Operational KPI Cards ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            size="default"
            title="Pending Records"
            value={pendingCount}
            variant="amber"
            icon={<Clock className="w-4 h-4" />}
            badge="Queue"
            description="Auction requests and MAO queue"
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="default"
            title="Submitted Requests"
            value={verifiedCount}
            variant="sky"
            icon={<Send className="w-4 h-4" />}
            badge="Submitted"
            description="Forwarded for MAO review"
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="default"
            title="Approved Clearances"
            value={approvedCount}
            variant="emerald"
            icon={<CheckCircle2 className="w-4 h-4" />}
            badge="Cleared"
            description="Official permits issued"
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="default"
            title="Subject to Revision"
            value={revisionCount}
            variant="amber"
            icon={<RotateCcw className="w-4 h-4" />}
            badge="Revision"
            description="Records requiring correction"
            onClick={() => router.push("/auction-inspections")}
          />
        </div>

        {/* ═══ Quick Actions Grid ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card
            onClick={() => setIsScannerOpen(true)}
            className="border-2 border-purple-200 bg-gradient-to-br from-purple-100/70 via-purple-50/40 to-white hover:border-purple-400 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-[#7C3AED] text-white group-hover:scale-105 transition-transform shrink-0 shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-[#7C3AED] transition-colors">
                    Scan Gate Pass
                  </h3>
                  <p className="text-xs font-medium text-slate-500">Fast gate ingress verify for animal lots</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition-all shrink-0" />
            </CardContent>
          </Card>

          <Card
            onClick={() => router.push("/auction-inspections/new")}
            className="border-2 border-purple-100 bg-gradient-to-br from-purple-50/60 via-white to-white hover:border-purple-300 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-purple-100 text-[#7C3AED] group-hover:scale-105 transition-transform shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-[#7C3AED] transition-colors">
                    Issue Clearance
                  </h3>
                  <p className="text-xs font-medium text-slate-500">Record transport and antemortem check</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition-all shrink-0" />
            </CardContent>
          </Card>

          <Card
            onClick={() => router.push("/auction-gis")}
            className="border-2 border-sky-100 bg-gradient-to-br from-sky-50/60 via-white to-white hover:border-sky-300 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-sky-100 text-sky-800 group-hover:scale-105 transition-transform shrink-0">
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-sky-800 transition-colors">
                    Movement GIS Map
                  </h3>
                  <p className="text-xs font-medium text-slate-500">Trace animal origin &amp; destination routes</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-800 group-hover:translate-x-0.5 transition-all shrink-0" />
            </CardContent>
          </Card>

          <Card
            onClick={() => router.push("/auction-announcement")}
            className="border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-white to-white hover:border-emerald-300 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 group-hover:scale-105 transition-transform shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-emerald-800 transition-colors">
                    Market Notices
                  </h3>
                  <p className="text-xs font-medium text-slate-500">Biosecurity alerts &amp; auction bulletins</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* ═══ Recent Inspections Table / Cards ═══ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#7C3AED]" />
                Recent Auction Movement Logs
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

          {isLoading ? (
            <Card className="border-2 border-slate-200/80 bg-white p-12 text-center rounded-2xl">
              <div className="flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
                <p className="text-sm font-bold text-slate-700">Loading livestock inspections...</p>
              </div>
            </Card>
          ) : isError ? (
            <Card className="border-2 border-rose-200 bg-rose-50 p-6 rounded-2xl text-center">
              <p className="text-sm font-bold text-rose-800">Unable to load inspections. Please refresh.</p>
            </Card>
          ) : inspections.length === 0 ? (
            <Card className="border-2 border-slate-200/80 bg-white p-12 text-center rounded-2xl">
              <div className="flex flex-col items-center justify-center space-y-2">
                <ClipboardCheck className="w-8 h-8 text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">No inspection records found</p>
                <p className="text-xs text-slate-400">Click &ldquo;New Movement Log&rdquo; to issue a clearance permit.</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <Card className="hidden md:block border-2 border-slate-200/80 bg-white shadow-xs rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                        <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 pl-5">
                          Control # &amp; Shipper
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
                      {inspections.slice(0, 6).map((record) => {
                        const totalHeads = record.items.reduce(
                          (sum, i) => sum + (Number(i.quantity) || 0),
                          0
                        );
                        return (
                          <TableRow
                            key={record.id}
                            onClick={() => setSelectedInspection(record)}
                            className="cursor-pointer border-b border-slate-100 hover:bg-purple-50/40 transition-colors"
                          >
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

                            <TableCell className="py-3.5">
                              <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[200px]">{record.destination}</span>
                              </div>
                            </TableCell>

                            <TableCell className="text-center py-3.5">
                              {getPurposeBadge(record.purpose)}
                            </TableCell>

                            <TableCell className="text-center py-3.5">
                              <span className="font-extrabold text-xs text-slate-700 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
                                {totalHeads} heads
                              </span>
                            </TableCell>

                            <TableCell className="text-center py-3.5">
                              <span className="text-xs font-semibold text-slate-500 font-mono">
                                {record.inspection_date}
                              </span>
                            </TableCell>

                            <TableCell className="text-center py-3.5">
                              {getStatusBadge(record.status, record)}
                            </TableCell>

                            <TableCell className="text-right py-3.5 pr-5">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInspection(record);
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

              {/* Mobile Responsive Cards View */}
              <div className="md:hidden space-y-3">
                {inspections.slice(0, 6).map((record) => {
                  const totalHeads = record.items.reduce(
                    (sum, i) => sum + (Number(i.quantity) || 0),
                    0
                  );
                  return (
                    <Card
                      key={record.id}
                      onClick={() => setSelectedInspection(record)}
                      className="border border-slate-200 bg-white p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-black text-sm text-slate-900">{record.shipper_name}</p>
                          <p className="text-[11px] font-mono text-purple-700 font-bold">{record.control_number}</p>
                        </div>
                        {getStatusBadge(record.status, record)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 my-2 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Destination</span>
                          <span className="font-semibold text-slate-800 truncate block">{record.destination}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Animals / Date</span>
                          <span className="font-semibold text-slate-800">{totalHeads} head(s) · {record.inspection_date}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                        {getPurposeBadge(record.purpose)}
                        <span className="text-xs font-black text-[#7C3AED] flex items-center gap-1">
                          View details <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inspection Details Dialog */}
      <InspectionDetailsDialog
        inspection={selectedInspection}
        onClose={() => setSelectedInspection(null)}
        statusBadge={selectedInspection ? getStatusBadge(selectedInspection.status, selectedInspection) : null}
        onActionSuccess={handleSuccess}
        onEdit={() => {
          if (selectedInspection) router.push(`/auction-inspections/new?edit=${selectedInspection.id}`);
          setSelectedInspection(null);
        }}
      />

      {/* Universal Gate Pass QR Scanner */}
      <UniversalQrScannerDialog
        isOpen={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        role="auction"
      />
    </>
  );
}
