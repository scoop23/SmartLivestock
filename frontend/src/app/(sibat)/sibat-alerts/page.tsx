"use client";

import React, { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  ShieldAlert,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Search,
  X,
  RotateCcw,
  Stethoscope,
  Skull,
  Tag,
  ArrowRight,
  Camera,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  useClinicalHealthRecords,
  useReviewClinicalHealth,
} from "../sibat/sibat-analytics";
import {
  SibatInspectionDialog,
  type SibatValidationRecord,
  type SibatInspectionData,
} from "../sibat-validation/sibat-inspection-dialog";

type TabKey = "pending" | "verified";
const TAB_PILLS: { value: TabKey; label: string }[] = [
  { value: "pending", label: "Needs review" },
  { value: "verified", label: "Reviewed reports" },
];

function SibatAlertsContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isCbat = user?.role?.toUpperCase() === "CBAT";
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const { records, isLoading } = useClinicalHealthRecords();
  const reviewMutation = useReviewClinicalHealth();

  const [selectedRecord, setSelectedRecord] = useState<SibatValidationRecord | null>(null);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const recordTypeParam = searchParams.get("recordType");
  const recordIdParam = searchParams.get("recordId");
  const notificationRecord = !isLoading && recordTypeParam && recordIdParam
    ? records.find((item) => item.reportType === recordTypeParam && item.id.endsWith(`-${recordIdParam}`)) ?? null
    : null;
  const activeRecord = selectedRecord ?? notificationRecord;
  const clearRecordLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("recordType");
    url.searchParams.delete("recordId");
    window.history.replaceState({}, "", url.toString());
  };

  const handleOpenInspection = (record: SibatValidationRecord) => {
    setSelectedRecord(record);
    setIsInspectionOpen(true);
  };

  const handleConfirmInspection = (
    recordId: string,
    action: "VERIFIED" | "FLAGGED" | "FALSE_ALARM",
    inspectionData: SibatInspectionData
  ) => {
    reviewMutation.mutate(
      {
        recordId,
        action,
        inspectionData,
      },
      {
        onSuccess: () => {
          if (action === "VERIFIED") {
            toast.success(`Alert ${recordId} verified!`, {
              description: "Status updated to VERIFIED. Forwarded to MAO queue.",
            });
          } else if (action === "FLAGGED") {
            toast.warning(`Alert ${recordId} flagged for emergency vet review.`);
          } else {
            toast.info(`Alert ${recordId} marked as discrepancy / false alarm.`);
          }
          setIsInspectionOpen(false);
          setSelectedRecord(null);
          if (recordIdParam) clearRecordLink();
        },
        onError: (err: unknown) => {
          toast.error("Failed to update alert status", {
            description: err instanceof Error ? err.message : "Check network connection",
          });
        },
      }
    );
  };

  const query = searchQuery.toLowerCase().trim();

  const tabFiltered = useMemo(() => {
    return records.filter((r) =>
      activeTab === "pending"
        ? r.status === "PENDING"
        : r.status === "VERIFIED" || r.status === "APPROVED" || r.status === "SUBJECT_TO_REVISION" || r.status === "SUBJECT_FOR_REVISION" || r.status === "REJECTED"
    );
  }, [records, activeTab]);

  const filtered = useMemo(() => {
    return tabFiltered.filter(
      (a) =>
        !query ||
        a.farmerName.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.id.toLowerCase().includes(query) ||
        a.barangayName.toLowerCase().includes(query) ||
        a.livestockTag.toLowerCase().includes(query)
    );
  }, [tabFiltered, query]);

  const pendingCount = records.filter((a) => a.status === "PENDING").length;
  const verifiedCount = records.filter((a) => a.status !== "PENDING").length;

  return (
    <>
      <PageHeader
        title="Health Reports"
        subtitle="Review disease and mortality reports from farmers, with field inspection photos when available."
        icon={<Bell className="h-5 w-5 text-amber-400" />}
        variant="sibat"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-4">
        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search farmer, alert condition, barangay, tag, ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm focus-visible:ring-[#1A365D]/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="rounded-xl text-xs font-bold gap-1.5 h-10 shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>

          <Separator className="opacity-60" />

          {/* Tab pills */}
          <div className="px-3 py-2.5 flex items-center gap-2 flex-wrap">
            {TAB_PILLS.map((tab) => {
              const isActive = activeTab === tab.value;
              const count = tab.value === "pending" ? pendingCount : verifiedCount;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                    border transition-all duration-200 active:scale-95 cursor-pointer
                    ${
                      isActive
                        ? "bg-[#1A365D] text-white border-[#1A365D] shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }
                  `}
                >
                  {tab.label}
                  <span
                    className={`text-[10px] font-extrabold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full leading-none ${
                      isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="ml-auto text-xs font-bold text-[#1A365D] hover:bg-slate-100 rounded-xl"
            >
              <Link href="/sibat?tab=health">
                Open Field Inspection Center
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            Showing{" "}
            <span className="text-slate-900 font-extrabold tabular-nums">
              {filtered.length}
            </span>{" "}
            report{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Alert Cards */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-slate-200 bg-white">
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <Card className="py-12 border-dashed border-slate-200 rounded-2xl bg-white">
                <div className="flex flex-col items-center text-center space-y-3 px-6">
                  <div className="p-3 rounded-2xl bg-slate-100">
                    <CheckCircle2 className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {activeTab === "pending"
                      ? "No reports need review"
                      : "No reviewed reports yet"}
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs font-medium">
                    {activeTab === "pending"
                      ? "New disease and mortality reports from farmers will appear here."
                      : "Reports you have reviewed will appear here."}
                  </p>
                </div>
              </Card>
            ) : (
              filtered.map((alert) => {
                const isDisease = alert.reportType === "DISEASE";
                const isPending = alert.status === "PENDING";
                const farmerPhotoUrl = alert.photoUrl;
                const sibatPhotoUrl = alert.inspection?.inspectorPhotoUrl;

                return (
                  <Card
                    key={alert.id}
                    className="border border-slate-200 bg-white hover:border-[#1A365D]/30 shadow-2xs hover:shadow-xs rounded-2xl transition-all duration-200 overflow-hidden"
                  >
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      {/* Header */}
                      <div className="flex justify-between items-start gap-3 flex-wrap">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={`text-[10px] font-black uppercase ${
                                isDisease
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : "bg-slate-800 text-amber-300 border-slate-700"
                              }`}
                            >
                              {isDisease ? "Disease report" : "Mortality report"} · {alert.id}
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400">•</span>
                            <span className="text-xs font-bold text-slate-700">{alert.farmerName}</span>
                          </div>

                          <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                            {isDisease ? (
                              <Stethoscope className="size-4 text-rose-600" />
                            ) : (
                              <Skull className="size-4 text-amber-500" />
                            )}
                            {alert.name}
                          </h3>

                          <div className="flex items-center gap-3 text-xs font-medium text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" /> {alert.barangayName}
                            </span>
                            <span className="flex items-center gap-1 font-bold text-amber-700">
                              <Tag className="w-3.5 h-3.5" /> {alert.livestockTag} ({alert.livestockBreed})
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" /> {alert.reportedDate}
                            </span>
                          </div>
                        </div>

                        {!isPending && (
                          <Badge
                            className={`font-bold text-[10px] uppercase shrink-0 ${
                              alert.status === "VERIFIED"
                                ? "bg-sky-100 text-sky-800 border-sky-300"
                                : alert.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-rose-100 text-rose-800 border-rose-300"
                            }`}
                          >
                            {alert.status === "VERIFIED" && (
                              <>
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Verified by SIBAT
                              </>
                            )}
                            {alert.status === "APPROVED" && (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                MAO Certified
                              </>
                            )}
                            {(alert.status === "SUBJECT_TO_REVISION" || alert.status === "SUBJECT_FOR_REVISION" || alert.status === "REJECTED" || alert.status === "FLAGGED") && (
                              <>
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Subject for Revision
                              </>
                            )}
                          </Badge>
                        )}
                      </div>

                      {/* Keep farmer evidence and SIBAT field photos separate so each image has clear context. */}
                      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Report details</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-700">
                            <strong>Farmer&apos;s description: </strong>{alert.farmerDescription || "No description was provided."}
                          </p>
                          {alert.photoName ? <p className="mt-1 text-xs text-slate-500">Farmer photo: {alert.photoName}</p> : null}
                        </div>

                        {(farmerPhotoUrl || sibatPhotoUrl) ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {farmerPhotoUrl ? (
                              <button
                                type="button"
                                onClick={() => handleOpenInspection(alert)}
                                className="group min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-white text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                aria-label="Open farmer's report photo"
                              >
                                <div className="relative aspect-[4/3] bg-slate-200">
                                  <img src={farmerPhotoUrl} alt={`Farmer-provided photo for ${alert.name}`} className="size-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                                  <span className="absolute bottom-2 left-2 rounded-lg bg-emerald-900/90 px-3 py-1.5 text-sm font-bold text-white">Farmer photo</span>
                                </div>
                                <span className="flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-slate-800"><Camera className="size-4 text-emerald-700" /> Tap to view report photo</span>
                              </button>
                            ) : null}
                            {sibatPhotoUrl ? (
                              <button
                                type="button"
                                onClick={() => handleOpenInspection(alert)}
                                className="group min-w-0 overflow-hidden rounded-xl border border-sky-200 bg-white text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                                aria-label="Open SIBAT field inspection photo"
                              >
                                <div className="relative aspect-[4/3] bg-slate-200">
                                  <img src={sibatPhotoUrl} alt={`SIBAT field inspection photo for ${alert.name}`} className="size-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                                  <span className="absolute bottom-2 left-2 rounded-lg bg-sky-900/90 px-3 py-1.5 text-sm font-bold text-white">SIBAT photo</span>
                                </div>
                                <span className="flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-slate-800"><Camera className="size-4 text-sky-700" /> Tap to view field photo</span>
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">No photos were attached to this report.</p>
                        )}
                      </section>

                      {alert.inspection && (
                        <div className="text-xs bg-sky-50 text-sky-950 p-3 rounded-xl border border-sky-200">
                          <p className="font-bold">Field inspection findings: {alert.inspection.remarks}</p>
                          <p className="text-[11px] text-sky-700 mt-0.5">
                            Severity: {alert.inspection.severity} • Action: {alert.inspection.biosecurityAction} • Inspector: {alert.inspection.verifiedBy}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-1">
                        <Button
                          onClick={() => handleOpenInspection(alert)}
                          className={`w-full rounded-xl h-10 font-black text-xs uppercase gap-2 cursor-pointer ${
                            isPending
                              ? "bg-[#1A365D] hover:bg-[#122744] text-white"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                          }`}
                        >
                          <ShieldAlert className="w-4 h-4 text-amber-300" />
                          {isCbat
                            ? "View report details"
                            : isPending
                              ? "Review report and record field check"
                              : "View report and field check"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Inspection Dialog */}
      <SibatInspectionDialog
        record={activeRecord}
        open={isInspectionOpen || notificationRecord !== null}
        onOpenChange={(open) => {
          setIsInspectionOpen(open);
          if (!open) {
            setSelectedRecord(null);
            if (recordIdParam) clearRecordLink();
          }
        }}
        onConfirmInspection={handleConfirmInspection}
        readOnly={isCbat}
      />
    </>
  );
}

export default function SibatAlertsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading field alerts...</div>}>
      <SibatAlertsContent />
    </Suspense>
  );
}
