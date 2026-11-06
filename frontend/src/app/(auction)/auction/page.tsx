"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  InspectionRecord,
  fetchInspections,
} from "../auction-inspections/auction-analytics";
import { InspectionDetailsDialog } from "../auction-inspections/inspection-details-dialog";
import { AuctionDescriptiveAnalytics } from "../components/auction-descriptive-analytics";



export default function AuctionDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);

  // React Query loads the role-scoped inspection list; KPI cards below summarize
  // those records and link to the full registry for filtering and review.
  const { data: inspections = [], isLoading, isError } = useQuery<InspectionRecord[]>({
    queryKey: ["inspections"],
    queryFn: () => fetchInspections(),
    staleTime: 30_000,
  });



  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["inspections"] });
  };

  // These counts describe workflow states only. They do not approve or issue a clearance.
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
          <span className="font-extrabold text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
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
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white shadow-xs border-b border-emerald-900/30">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
              <ClipboardCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black">
                Auction Livestock Intake Active — Padre Garcia Livestock Trading Center
              </p>
              <p className="text-[10px] text-emerald-100 font-semibold">
                Auction records are submitted to MAO for official review and clearance decisions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => router.push("/auction-inspections/new")}
              className="bg-white hover:bg-emerald-50 text-[#0F5A38] text-xs font-black rounded-xl shadow-md gap-1.5 cursor-pointer active:scale-95 hover:-translate-y-0.5 transition-all duration-200"
            >
              <Plus className="w-3.5 h-3.5" />
              New Movement Log
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ═══ Operational Clearance Queue ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75 fill-mode-both motion-reduce:animate-none">
          <KpiCard
            size="sm"
            title="Pending Records"
            value={pendingCount}
            variant="amber"
            icon={<Clock className="w-4 h-4" />}
            badge="Queue"
            description="Auction requests and MAO queue"
            isLoading={isLoading}
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="sm"
            title="Submitted Requests"
            value={verifiedCount}
            variant="sky"
            icon={<Send className="w-4 h-4" />}
            badge="Submitted"
            description="Forwarded for MAO review"
            isLoading={isLoading}
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="sm"
            title="Approved Clearances"
            value={approvedCount}
            variant="emerald"
            icon={<CheckCircle2 className="w-4 h-4" />}
            badge="Cleared"
            description="Official permits issued"
            isLoading={isLoading}
            onClick={() => router.push("/auction-inspections")}
          />
          <KpiCard
            size="sm"
            title="Subject to Revision"
            value={revisionCount}
            variant="amber"
            icon={<RotateCcw className="w-4 h-4" />}
            badge="Revision"
            description="Records requiring correction"
            isLoading={isLoading}
            onClick={() => router.push("/auction-inspections")}
          />
        </div>

        {/* ═══ Futuristic Market Descriptive Analytics Console ═══ */}
        <AuctionDescriptiveAnalytics />

        {/* ═══ Recent Inspections Table / Cards ═══ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#0F5A38]" />
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
              className="rounded-xl text-xs font-extrabold text-[#0F5A38] hover:bg-emerald-50 border-emerald-200 gap-1 cursor-pointer"
            >
              View Full Registry <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {isLoading ? (
            <Card className="border-2 border-slate-200/80 bg-white p-12 text-center rounded-2xl">
              <div className="flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-[#0F5A38] animate-spin" />
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
              <Card className="hidden md:block rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-holo-card overflow-hidden">
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
                            className="cursor-pointer border-b border-slate-100 hover:bg-emerald-50/40 transition-colors"
                          >
                            <TableCell className="py-3.5 pl-5">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-50 text-[#0F5A38] border border-emerald-100/60 shrink-0">
                                  <ClipboardCheck className="size-4 text-[#0F5A38]" />
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
                                className="rounded-xl h-8 px-3 text-xs font-extrabold bg-[#0F5A38] text-white hover:bg-[#0c482d] transition-colors shadow-2xs gap-1 cursor-pointer"
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
                      className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-4 shadow-holo-card cursor-pointer hover:border-emerald-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-black text-sm text-slate-900">{record.shipper_name}</p>
                          <p className="text-[11px] font-mono text-emerald-700 font-bold">{record.control_number}</p>
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
                        <span className="text-xs font-black text-[#0F5A38] flex items-center gap-1">
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

    </>
  );
}
