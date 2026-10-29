"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import {
ArrowRight,
Calendar,
Camera,
CheckCircle2,
Clock,
MapPin,
RotateCcw,
Search,
ShieldAlert,
ShieldCheck,
Skull,
Stethoscope,
Tag,
X
} from "lucide-react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { Suspense,startTransition,useEffect,useMemo,useState } from "react";
import { toast } from "sonner";
import { hasPossibleFmdSigns } from "@/lib/fmd-signs";
import {
SibatInspectionDialog,
type SibatInspectionData,
type SibatStatus,
type SibatValidationRecord,
} from "../sibat-validation/sibat-inspection-dialog";
import {
useClinicalHealthRecords,
useReviewClinicalHealth,
} from "../sibat/sibat-analytics";

type StatusFilterOption = "Needs Review" | "Forwarded to MAO" | "MAO Approved";

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

  if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION" || s === "REJECTED") {
    return (
      <Badge className="border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800">
        <RotateCcw className="mr-1 size-3 text-rose-600" />
        Returned for Correction
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Filter States matching DiseasesPage design basis
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption | null>(null);

  const { records, isLoading, isError } = useClinicalHealthRecords();
  const reviewMutation = useReviewClinicalHealth();

  const isCbat = user?.role === "CBAT";
  const needsReviewCount = records.filter((record) =>
    record.status === "PENDING" || record.status === "SUBJECT_TO_REVISION" || record.status === "SUBJECT_FOR_REVISION"
  ).length;
  const forwardedCount = records.filter((record) => record.status === "VERIFIED").length;

  const status: StatusFilterOption =
    statusFilter ??
    (isCbat && needsReviewCount === 0 && forwardedCount > 0
      ? "Forwarded to MAO"
      : "Needs Review");
  const setStatus = (nextStatus: StatusFilterOption) => setStatusFilter(nextStatus);

  const [selectedRecord, setSelectedRecord] = useState<SibatValidationRecord | null>(null);
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(null);
  const [dismissedNotificationKey, setDismissedNotificationKey] = useState<string | null>(null);

  const recordTypeParam = searchParams.get("recordType");
  const recordIdParam = searchParams.get("recordId");
  const normalizedRecordType = recordTypeParam?.toUpperCase();
  const notificationPrefix = normalizedRecordType === "DISEASE"
    ? "DIS"
    : normalizedRecordType === "MORTALITY"
      ? "MOR"
      : null;
  const notificationKey = notificationPrefix && recordIdParam && /^\d+$/.test(recordIdParam)
    ? `${normalizedRecordType}:${recordIdParam}`
    : null;
  useEffect(() => {
    if (!notificationKey && dismissedNotificationKey) {
      startTransition(() => setDismissedNotificationKey(null));
    }
  }, [notificationKey, dismissedNotificationKey]);

  const notificationRecord =
    !isLoading && notificationPrefix && notificationKey && dismissedNotificationKey !== notificationKey
      ? records.find(
          (item) =>
            item.reportType === normalizedRecordType &&
            item.id === `${notificationPrefix}-${recordIdParam}`
        ) ?? null
      : null;
  const reportLookupFailed = !!(
    notificationKey && !isLoading && !notificationRecord &&
    dismissedNotificationKey !== notificationKey && isError
  );
  const reportNotInScope = !!(
    notificationKey && !isLoading && !notificationRecord &&
    dismissedNotificationKey !== notificationKey && !isError
  );

  const activeRecord = selectedRecord ?? notificationRecord;
  const highlightedRecordId = selectedRecord?.id ?? notificationRecord?.id ?? focusedRecordId;

  useEffect(() => {
    if (!notificationRecord) return;
    startTransition(() => setFocusedRecordId(notificationRecord.id));
  }, [notificationRecord?.id]);

  const clearRecordLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("recordType");
    url.searchParams.delete("recordId");
    router.replace(`${pathname}${url.search}${url.hash}`, { scroll: false });
  };

  const handleOpenInspection = (record: SibatValidationRecord) => {
    setFocusedRecordId(record.id);
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
            toast.warning(`Alert ${recordId} returned for revision.`, {
              description: "MAO was notified of the concern for veterinary follow-up.",
            });
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

      if (status === "Needs Review") {
        return d.status === "PENDING" || d.status === "SUBJECT_TO_REVISION" || d.status === "SUBJECT_FOR_REVISION";
      }

      if (status === "Forwarded to MAO") {
        return d.status === "VERIFIED";
      }

      return d.status === "APPROVED";
    });
  }, [records, query, status]);

  const assignedScopeLabel =
    user?.accessScope === "ALL_BARANGAYS"
      ? "All Barangays"
      : user?.assignedBarangayName || "your assigned barangays";

  useEffect(() => {
    if (!highlightedRecordId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`sibat-alert-record-${highlightedRecordId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightedRecordId, notificationKey, filtered]);

  return (
    <div className="min-h-screen pb-16">
      {/* ── PageHeader ── */}
      <PageHeader
        title="Health Reports"
        subtitle={
          <>
            <span className="hidden sm:inline">Review signs and symptoms reported by farmers. Reports are not confirmed diagnoses.</span>
            <span className="sm:hidden">Review farmer symptom reports.</span>
          </>
        }
        icon={<Stethoscope className="size-6 text-white" />}
        variant="farmer"
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
        maxWidthClass="w-full"
      />

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Scope Strip ── */}
        <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs font-semibold text-sky-950 sm:px-4">
          <MapPin className="size-4.5 text-sky-700 shrink-0" />
          <span>
            {user?.accessScope === "ALL_BARANGAYS" ? "Showing reports from all authorized barangays:" : "Showing only reports from your assigned barangay:"}{" "}
            <strong className="font-black text-sky-900">{assignedScopeLabel}</strong>.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setStatus("Needs Review")}
            className={`flex items-center gap-3 rounded-xl border p-3.5 sm:p-4 text-left transition-all ${
              status === "Needs Review"
                ? "border-rose-400 bg-rose-50/80 ring-2 ring-rose-300 shadow-xs"
                : "border-rose-200 bg-gradient-to-r from-rose-50 to-white hover:border-rose-300"
            }`}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600"><Clock className="size-6" /></span>
            <div><p className="text-xs font-bold text-rose-800">Needs Review</p><p className="mt-0.5 text-2xl font-black leading-none text-slate-900">{isLoading ? "—" : needsReviewCount}</p><p className="mt-1 text-xs text-slate-500">Awaiting review or correction</p></div>
          </button>
          <button
            type="button"
            onClick={() => setStatus("Forwarded to MAO")}
            className={`flex items-center gap-3 rounded-xl border p-3.5 sm:p-4 text-left transition-all ${
              status === "Forwarded to MAO"
                ? "border-sky-400 bg-sky-50/80 ring-2 ring-sky-300 shadow-xs"
                : "border-sky-200 bg-gradient-to-r from-sky-50 to-white hover:border-sky-300"
            }`}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-600"><ShieldCheck className="size-6" /></span>
            <div><p className="text-xs font-bold text-sky-800">Forwarded to MAO</p><p className="mt-0.5 text-2xl font-black leading-none text-slate-900">{isLoading ? "—" : forwardedCount}</p><p className="mt-1 text-xs text-slate-500">Sent for further review</p></div>
          </button>
        </div>

        {/* ── Filter Card ── */}
        <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <CardContent className="flex flex-col items-stretch gap-2.5 p-2.5 sm:flex-row sm:items-center sm:p-3.5">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                aria-label="Search disease reports"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by farmer, barangay, or report ID..."
                className="h-10 rounded-lg border-slate-200 bg-white pl-10 pr-9 text-sm font-medium focus-visible:ring-[#1A365D]/30"
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
            <div className="w-full shrink-0 sm:w-52">
              <Select value={status} onValueChange={(value) => setStatus(value as StatusFilterOption)}>
                <SelectTrigger
                  aria-label="Filter disease status"
                  className="h-10 w-full rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-800 focus-visible:ring-[#1A365D]/30"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Needs Review">Needs Review</SelectItem>
                  <SelectItem value="Forwarded to MAO">Forwarded to MAO</SelectItem>
                  <SelectItem value="MAO Approved">MAO Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Secondary actions / reset */}
            {(query || status !== "Needs Review") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatus("Needs Review");
                }}
                className="h-10 rounded-lg text-xs font-bold text-slate-600 gap-1.5 shrink-0"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset</span>
              </Button>
            )}


          </CardContent>
        </Card>

        {/* ── Results Summary Counter ── */}
        <div className="flex items-center justify-between px-1">
          <div><h2 className="text-base font-bold text-slate-900">Reports</h2><p className="mt-0.5 text-xs text-slate-500">Showing {filtered.length} reports</p></div>
          {status !== "Needs Review" && (
            <Badge variant="outline" className="text-[10px] font-bold text-slate-500 bg-white">
              Filter: {status}
            </Badge>
          )}
        </div>

        {/* ── Report List ── */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-xl border-slate-200 bg-white">
                <CardContent className="space-y-3 p-4">
                  <div className="flex gap-3">
                    <Skeleton className="size-11 rounded-full" />
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
          <div className="space-y-2">
            {filtered.map((d) => {
              const isDisease = d.reportType === "DISEASE";
              const isFmdSuspected = d.inspection?.fmdAssessment === "SUSPECTED";
              const hasPossibleFmd = isDisease && hasPossibleFmdSigns([
                ...(d.farmerSymptoms || []),
                d.name,
                d.farmerDescription,
                ...(d.inspection?.confirmedSymptoms || []),
              ].filter(Boolean));
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
                  id={`sibat-alert-record-${d.id}`}
                  className={`overflow-hidden rounded-xl border shadow-2xs transition-all ${d.id === highlightedRecordId ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-300" : "border-slate-200 bg-white"}`}
                >
                  <CardContent className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.95fr)_auto] sm:items-center sm:p-3.5">
                      {/* Left: Report Marker + Info */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* report-marker */}
                        <div
                          className={`grid size-11 shrink-0 place-items-center rounded-full border ${
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
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Row 1: ID + Status + Tag */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-slate-800">
                              {d.id}
                            </span>
                            <StatusBadge status={d.status} />
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold text-slate-500 bg-white"
                            >
                              {isDisease ? "Disease Report" : "Mortality Report"}
                            </Badge>
                            {isFmdSuspected ? (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-bold">
                                Suspected FMD
                              </Badge>
                            ) : hasPossibleFmd ? (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold">
                                Possible FMD Pattern
                              </Badge>
                            ) : null}
                          </div>

                          {/* Row 2: Farmer Name */}
                          <h2 className="truncate text-sm font-bold text-slate-900">
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

                          <div className="flex items-center gap-2 truncate pt-0.5 text-[11px] font-medium text-slate-500">
                            <Tag className="size-3.5 text-amber-700 shrink-0" />
                            <span className="truncate">{cattleLabel}</span>
                          </div>

                          {/* Photos indicator if present */}
                          {(farmerPhoto || inspectorPhoto) && (
                            <div className="flex items-center gap-1 pt-0.5 text-[10px] font-medium text-slate-500">
                              <Camera className="size-3.5 text-slate-400" />
                              <span>
                                Attached report media
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="min-h-16 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">Reported signs</p>
                        <p className="line-clamp-2 leading-relaxed">{reportedSigns}</p>
                      </div>

                      <div className="w-full shrink-0 sm:w-auto">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenInspection(d)}
                          className="h-10 w-full gap-1.5 rounded-lg bg-sky-50 px-4 text-xs font-bold text-sky-700 hover:bg-sky-100 sm:w-auto"
                        >
                          <span>View Report</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* ── Empty State ── */}
            {filtered.length === 0 && (
              <Card className="rounded-xl border-dashed border-slate-300 bg-white py-14 text-center">
                <CardContent className="flex flex-col items-center justify-center space-y-3 px-6">
                  <div className="grid size-12 place-items-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 shadow-2xs">
                    <Stethoscope className="size-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    No reports found
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm font-medium">
                    Try changing your search or status filter.
                  </p>
                  {(query || status !== "Needs Review") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setQuery("");
                        setStatus("Needs Review");
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

      <Dialog
        open={reportNotInScope || reportLookupFailed}
        onOpenChange={(open) => {
          if (!open && notificationKey) clearRecordLink();
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-rose-200 bg-white">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${reportLookupFailed ? "text-amber-950" : "text-rose-950"}`}>
              <ShieldAlert className={`size-5 ${reportLookupFailed ? "text-amber-700" : "text-rose-700"}`} />
              {reportLookupFailed ? "Could not check this report" : "Report not found in your authorized scope"}
            </DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              {reportLookupFailed
                ? "SmartLivestock could not load the authorized report list. Check your connection and try again."
                : "No matching report is available for this account or assigned barangay. Check the QR code, or ask MAO to confirm your barangay access."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={clearRecordLink} className="w-full rounded-xl bg-[#1A365D] text-white hover:bg-[#132742] sm:w-auto">
              Back to Health Reports
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          readOnly={isCbat || activeRecord.status === "VERIFIED" || activeRecord.status === "APPROVED"}
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
