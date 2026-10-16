"use client";

import React, { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
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
  AlertTriangle,
  Info,
  Calendar,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  type SibatStatus,
} from "../sibat-validation/sibat-inspection-dialog";

type StatusFilterOption = "All Statuses" | "Needs Review" | "Reviewed" | "Forwarded to MAO";

function StatusBadge({ status }: { status: SibatStatus }) {
  const s = (status || "PENDING").toUpperCase();

  if (s === "PENDING") {
    return (
      <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-0.5">
        <Clock className="size-3 mr-1 text-amber-700" />
        Needs Review
      </Badge>
    );
  }

  if (s === "VERIFIED") {
    return (
      <Badge className="bg-sky-100 text-sky-900 border border-sky-300 text-[11px] font-bold px-2 py-0.5">
        <ShieldCheck className="size-3 mr-1 text-sky-700" />
        Forwarded to MAO
      </Badge>
    );
  }

  if (s === "APPROVED") {
    return (
      <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold px-2 py-0.5">
        <CheckCircle2 className="size-3 mr-1 text-emerald-700" />
        MAO Approved
      </Badge>
    );
  }

  if (s === "FLAGGED") {
    return (
      <Badge className="bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-bold px-2 py-0.5">
        <ShieldAlert className="size-3 mr-1 text-rose-700" />
        Flagged Alert
      </Badge>
    );
  }

  return (
    <Badge className="bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold px-2 py-0.5">
      <RotateCcw className="size-3 mr-1 text-rose-600" />
      Needs Revision
    </Badge>
  );
}

function SibatAlertsContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isCbat = user?.role?.toUpperCase() === "CBAT";

  // Filter States matching DiseasesPage design basis
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilterOption>("All Statuses");

  const { records, isLoading } = useClinicalHealthRecords();
  const reviewMutation = useReviewClinicalHealth();

  const [selectedRecord, setSelectedRecord] = useState<SibatValidationRecord | null>(null);
  const [dismissedNotificationKey, setDismissedNotificationKey] = useState<string | null>(null);

  const recordTypeParam = searchParams.get("recordType");
  const recordIdParam = searchParams.get("recordId");
  const normalizedRecordType = recordTypeParam?.toUpperCase();
  const notificationPrefix = normalizedRecordType === "DISEASE"
    ? "DIS"
    : normalizedRecordType === "MORTALITY"
      ? "MOR"
      : null;
  const notificationKey = recordTypeParam && recordIdParam
    ? `${normalizedRecordType}:${recordIdParam}`
    : null;
  const notificationRecord =
    !isLoading && notificationPrefix && notificationKey && dismissedNotificationKey !== notificationKey
      ? records.find(
          (item) =>
            item.reportType === normalizedRecordType &&
            item.id === `${notificationPrefix}-${recordIdParam}`
        ) ?? null
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
          setSelectedRecord(null);
          if (notificationKey) {
            setDismissedNotificationKey(notificationKey);
            clearRecordLink();
          }
        },
        onError: (err: unknown) => {
          toast.error("Failed to update alert status", {
            description:
              err instanceof Error ? err.message : "Check network connection",
          });
        },
      }
    );
  };

  // Filter logic matching the design guide: `${d.farmer} ${d.id} ${d.barangay}` + status
  const filtered = useMemo(() => {
    const cleanQuery = query.toLowerCase().trim();

    return records.filter((d) => {
      const matchSearch =
        !cleanQuery ||
        `${d.farmerName} ${d.id} ${d.barangayName} ${d.name} ${d.livestockTag}`
          .toLowerCase()
          .includes(cleanQuery);

      if (!matchSearch) return false;

      if (status === "All Statuses") return true;

      if (status === "Needs Review") {
        return d.status === "PENDING";
      }

      if (status === "Reviewed") {
        return (
          d.status === "VERIFIED" ||
          d.status === "APPROVED" ||
          d.status === "FLAGGED" ||
          d.status === "FALSE_ALARM" ||
          d.status === "SUBJECT_TO_REVISION" ||
          d.status === "SUBJECT_FOR_REVISION" ||
          d.status === "REJECTED"
        );
      }

      if (status === "Forwarded to MAO") {
        return d.status === "VERIFIED" || d.status === "APPROVED";
      }

      return true;
    });
  }, [records, query, status]);

  const assignedScopeLabel =
    user?.accessScope === "ALL_BARANGAYS"
      ? "All Barangays"
      : user?.assignedBarangayName || "your assigned barangays";

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* ── PageHeader ── */}
      <PageHeader
        title="Disease Reports"
        subtitle="Review signs and symptoms reported by farmers. Reports are not confirmed diagnoses."
        icon={<Stethoscope className="h-5 w-5 text-rose-600" />}
        variant="sibat"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full max-w-7xl mx-auto space-y-4">
        {/* ── Scope Strip ── */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-950 shadow-2xs">
          <MapPin className="size-4.5 text-sky-700 shrink-0" />
          <span>
            Showing only reports from your assigned barangays:{" "}
            <strong className="font-black text-sky-900">{assignedScopeLabel}</strong>.
          </span>
        </div>

        {/* ── Warning Strip ── */}
        <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 shadow-2xs">
          <div className="size-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <Stethoscope className="size-4.5" />
          </div>
          <div className="space-y-0.5">
            <b className="text-xs font-black uppercase tracking-wider text-amber-950 block">
              Use reported information only
            </b>
            <span className="text-xs text-amber-900/90 leading-relaxed font-medium block">
              Review and forward reports to authorized personnel when needed. Do
              not treat a report as a confirmed disease.
            </span>
          </div>
        </div>

        {/* ── Filter Card ── */}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <CardContent className="p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                aria-label="Search disease reports"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by farmer, barangay, or report ID"
                className="pl-10 pr-9 bg-slate-50/70 border-slate-200 rounded-xl h-11 text-sm font-medium focus-visible:ring-[#1A365D]/30"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 size-9 -translate-y-1/2 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {/* Status Select */}
            <div className="w-full md:w-56 shrink-0">
              <Select value={status} onValueChange={(value) => setStatus(value as StatusFilterOption)}>
                <SelectTrigger
                  aria-label="Filter disease status"
                  className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-800 focus-visible:ring-[#1A365D]/30"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Statuses">All Statuses</SelectItem>
                  <SelectItem value="Needs Review">Needs Review</SelectItem>
                  <SelectItem value="Reviewed">Reviewed</SelectItem>
                  <SelectItem value="Forwarded to MAO">Forwarded to MAO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Secondary actions / reset */}
            {(query || status !== "All Statuses") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatus("All Statuses");
                }}
                className="h-11 rounded-xl text-xs font-bold text-slate-600 gap-1.5 shrink-0"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset</span>
              </Button>
            )}

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-[#1A365D] hover:bg-slate-100 rounded-xl h-11 px-3 shrink-0 ml-auto hidden lg:inline-flex"
            >
              <Link href="/sibat?tab=health">
                Field Inspection Center
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* ── Results Summary Counter ── */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-slate-600">
            Showing{" "}
            <span className="text-slate-900 font-black tabular-nums">
              {filtered.length}
            </span>{" "}
            report{filtered.length !== 1 ? "s" : ""}
          </p>
          {status !== "All Statuses" && (
            <Badge variant="outline" className="text-[10px] font-bold text-slate-500 bg-white">
              Filter: {status}
            </Badge>
          )}
        </div>

        {/* ── Report List ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-2xl border-slate-200 bg-white">
                <CardContent className="p-5 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="size-12 rounded-2xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-1/4" />
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3.5">
            {filtered.map((d) => {
              const isDisease = d.reportType === "DISEASE";
              const reportedSigns =
                d.farmerSymptoms && d.farmerSymptoms.length > 0
                  ? d.farmerSymptoms.join(", ")
                  : d.farmerDescription || d.name || "Unspecified signs";

              const cattleLabel = `${d.livestockTag || "Tag unassigned"}${
                d.livestockBreed || d.livestockType
                  ? ` • ${d.livestockBreed || d.livestockType}`
                  : ""
              }`;

              const farmerPhoto = d.photoUrl;
              const inspectorPhoto = d.inspection?.inspectorPhotoUrl;

              return (
                <Card
                  key={d.id}
                  className="rounded-2xl border border-slate-200/90 bg-white hover:border-[#1A365D]/40 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden"
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Left: Report Marker + Info */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* report-marker */}
                        <div
                          className={`size-11 sm:size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border ${
                            isDisease
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isDisease ? (
                            <Stethoscope className="size-6 text-rose-600" />
                          ) : (
                            <Skull className="size-6 text-amber-600" />
                          )}
                        </div>

                        {/* report-info */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Row 1: ID + Status + Tag */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                              {d.id}
                            </span>
                            <StatusBadge status={d.status} />
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold text-slate-500 bg-white"
                            >
                              {isDisease ? "Disease Report" : "Mortality Report"}
                            </Badge>
                          </div>

                          {/* Row 2: Farmer Name */}
                          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                            {d.farmerName || "Registered Farmer"}
                          </h2>

                          {/* Row 3: Barangay • Reported Date */}
                          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <MapPin className="size-3.5 text-slate-400" />
                              {d.barangayName || "Padre Garcia"}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3.5 text-slate-400" />
                              Reported {d.reportedDate || d.reportedAt?.slice(0, 10)}
                            </span>
                          </p>

                          {/* Row 4: Reported signs */}
                          <div className="text-xs bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-slate-700">
                            <b className="font-bold text-slate-900">Reported signs: </b>
                            <span className="text-slate-800 font-medium">
                              {reportedSigns}
                            </span>
                          </div>

                          {/* Row 5: Cattle / Animal Identification */}
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 pt-0.5">
                            <Tag className="size-3.5 text-amber-700 shrink-0" />
                            <span className="truncate">{cattleLabel}</span>
                          </div>

                          {/* Photos indicator if present */}
                          {(farmerPhoto || inspectorPhoto) && (
                            <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-slate-500">
                              <Camera className="size-3.5 text-slate-400" />
                              <span>
                                Attached media:{" "}
                                {[
                                  farmerPhoto ? "Farmer photo" : null,
                                  inspectorPhoto ? "Field inspection photo" : null,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Button */}
                      <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex sm:flex-col justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenInspection(d)}
                          className="w-full sm:w-auto rounded-xl font-bold text-xs h-10 px-4 bg-slate-100 hover:bg-[#1A365D] hover:text-white text-slate-800 border border-slate-200 transition-all cursor-pointer shadow-2xs gap-1.5"
                        >
                          <span>View Report</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* ── Empty State ── */}
            {filtered.length === 0 && (
              <Card className="rounded-2xl border-dashed border-slate-300 bg-white py-14 text-center">
                <CardContent className="flex flex-col items-center justify-center space-y-3 px-6">
                  <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shadow-2xs">
                    <Stethoscope className="size-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    No reports found
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm font-medium">
                    Try changing your search or status filter.
                  </p>
                  {(query || status !== "All Statuses") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        setStatus("All Statuses");
                      }}
                      className="rounded-xl text-xs font-bold gap-1.5 mt-1"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Reset Filters</span>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── Inspection & Review Dialog ── */}
      {activeRecord && (
        <SibatInspectionDialog
          key={activeRecord.id}
          record={activeRecord}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRecord(null);
              if (notificationKey) {
                setDismissedNotificationKey(notificationKey);
                clearRecordLink();
              }
            }
          }}
          onConfirmInspection={handleConfirmInspection}
          isSubmitting={reviewMutation.isPending}
          readOnly={isCbat}
        />
      )}
    </div>
  );
}

export default function SibatAlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500 font-medium">
          Loading disease reports...
        </div>
      }
    >
      <SibatAlertsContent />
    </Suspense>
  );
}
