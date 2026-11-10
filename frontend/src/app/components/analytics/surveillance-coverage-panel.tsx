"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CircleHelp, LayoutGrid, List, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import api from "@/lib/axios";

type CoverageDomain = "DISEASE" | "MORTALITY";
type ConfirmationStatus = "NO_REPORTS_RECEIVED" | "REPORTS_COMPLETE";
type CoverageViewMode = "GRID" | "LIST";

interface CoverageBarangay {
  barangay_id: number;
  barangay_name: string;
  record_count: number;
  approved_record_count: number;
  needs_approval_count: number;
  state: "UNCONFIRMED" | "CONFIRMED" | "STALE" | "INCONSISTENT";
  confirmation: {
    status: ConfirmationStatus;
    confirmed_at: string;
    confirmed_by: string;
  } | null;
  can_confirm_no_reports: boolean;
  can_confirm_reports_complete: boolean;
}

interface CoverageResponse {
  domain: CoverageDomain;
  report_month: string;
  barangays: CoverageBarangay[];
  unassigned_record_count: number;
}

interface CoverageConfirmationRequest {
  barangay_id: number;
  status: ConfirmationStatus;
  domain: CoverageDomain;
  report_month: string;
}

interface PendingCoverageConfirmation extends CoverageConfirmationRequest {
  barangay_name: string;
}

function previousMonthValue() {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
}

function stateLabel(state: CoverageBarangay["state"]) {
  if (state === "CONFIRMED") return "Coverage confirmed";
  if (state === "STALE") return "New report needs reconfirmation";
  if (state === "INCONSISTENT") return "Confirmation needs review";
  return "Not confirmed";
}

function CoverageViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: CoverageViewMode;
  onChange: (mode: CoverageViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 self-start rounded-xl border border-slate-200 bg-slate-50 p-1 sm:self-auto" role="group" aria-label="Coverage display style">
      <button
        type="button"
        aria-pressed={viewMode === "LIST"}
        onClick={() => onChange("LIST")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
          viewMode === "LIST" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
        }`}
      >
        <List className="size-3.5" /> List
      </button>
      <button
        type="button"
        aria-pressed={viewMode === "GRID"}
        onClick={() => onChange("GRID")}
        className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
          viewMode === "GRID" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
        }`}
      >
        <LayoutGrid className="size-3.5" /> Grid
      </button>
    </div>
  );
}

function formatReportMonth(ym: string) {
  if (!ym) return "";
  const parts = ym.split("-").map(Number);
  if (parts.length < 2 || !parts[0] || !parts[1]) return ym;
  const d = new Date(parts[0], parts[1] - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function CompactSingleBarangayCard({
  row,
  domain,
  reportMonth,
  setDomain,
  setReportMonth,
  confirmationMutation,
  requestConfirmation,
  recordsHrefFor,
}: {
  row: CoverageBarangay;
  domain: CoverageDomain;
  reportMonth: string;
  setDomain: (d: CoverageDomain) => void;
  setReportMonth: (m: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  confirmationMutation: any;
  requestConfirmation: (row: CoverageBarangay, status: ConfirmationStatus) => void;
  recordsHrefFor: (barangayName: string) => string;
}) {
  const isConfirmed = row.state === "CONFIRMED";
  const isStale = row.state === "STALE" || row.state === "INCONSISTENT";

  const isConfirmedNoReports = isConfirmed && row.confirmation?.status === "NO_REPORTS_RECEIVED";
  const isConfirmedAllEntered = isConfirmed && row.confirmation?.status === "REPORTS_COMPLETE";

  const isPendingNoReports =
    confirmationMutation.isPending &&
    confirmationMutation.variables?.barangay_id === row.barangay_id &&
    confirmationMutation.variables?.status === "NO_REPORTS_RECEIVED";

  const isPendingAllEntered =
    confirmationMutation.isPending &&
    confirmationMutation.variables?.barangay_id === row.barangay_id &&
    confirmationMutation.variables?.status === "REPORTS_COMPLETE";

  const canAttestNoReports =
    row.can_confirm_no_reports && !isConfirmedNoReports && !confirmationMutation.isPending;

  const canAttestAllEntered =
    row.can_confirm_reports_complete &&
    row.record_count > 0 &&
    row.approved_record_count === row.record_count &&
    !isConfirmedAllEntered &&
    !confirmationMutation.isPending;

  return (
    <section
      className={`rounded-2xl border bg-white p-3 sm:p-3.5 shadow-2xs transition-all ${
        isConfirmed
          ? "border-emerald-200/90 bg-gradient-to-r from-emerald-50/40 via-white to-white"
          : isStale
          ? "border-rose-200/90 bg-gradient-to-r from-rose-50/30 via-white to-white"
          : "border-slate-200/90 bg-white"
      }`}
      aria-labelledby="single-barangay-title"
    >
      {/* Row 1: Barangay Identity, Status, Domain Toggle, Month Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-[#1E4D2B] border border-emerald-200/80 shrink-0">
            <MapPin className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="single-barangay-title" className="text-sm font-black text-slate-900 tracking-tight truncate">
                {row.barangay_name}
              </h2>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                Assigned Barangay
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                Monthly Attestation
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                  isConfirmed
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : isStale
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isConfirmed ? "bg-emerald-500" : isStale ? "bg-rose-500" : "bg-amber-500 animate-pulse"
                  }`}
                />
                {stateLabel(row.state)}
              </span>
              {row.needs_approval_count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300/80 shrink-0">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {row.needs_approval_count} unfinished report{row.needs_approval_count === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Confirm reporting for <span className="font-semibold text-slate-700">{formatReportMonth(reportMonth)}</span> · Confirmed coverage updates the MAO municipal records.
            </p>
          </div>
        </div>

        {/* Right side controls: Domain Switcher + Month Picker */}
        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs">
            {(["DISEASE", "MORTALITY"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={domain === item}
                onClick={() => setDomain(item)}
                className={`h-7 px-2.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  domain === item
                    ? "bg-[#1E4D2B] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item === "DISEASE" ? "Disease" : "Mortality"}
              </button>
            ))}
          </div>

          <input
            type="month"
            value={reportMonth}
            max={previousMonthValue()}
            onChange={(event) => setReportMonth(event.target.value)}
            className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
          />
        </div>
      </div>

      {/* Row 2: Compact Metrics Chips & Action Controls */}
      <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* Left: Compact Metrics Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Reports:</span>
            <span className="font-bold text-slate-900">{row.record_count}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Approved:</span>
            <span className="font-mono font-bold text-emerald-700">{row.approved_record_count}</span>
            <span className="text-slate-400 font-normal">/</span>
            <span className="font-mono text-slate-700">{row.record_count}</span>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs border ${
              row.needs_approval_count > 0
                ? "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                : "bg-slate-50 border-slate-200/80 text-slate-700"
            }`}
          >
            <span className={`text-[11px] ${row.needs_approval_count > 0 ? "text-amber-800" : "text-slate-500 font-medium"}`}>
              Pending:
            </span>
            <span className="font-mono font-bold">{row.needs_approval_count}</span>
          </div>

          {row.confirmation && (
            <span className="text-[11px] text-slate-500 hidden md:inline pl-1">
              Confirmed by <span className="font-bold text-slate-700">{row.confirmation.confirmed_by}</span>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {row.needs_approval_count > 0 && (
            <Link
              href={recordsHrefFor(row.barangay_name)}
              className="inline-flex h-7.5 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100 shadow-2xs"
            >
              <ArrowRight className="size-3.5 text-amber-700" />
              Review ({row.needs_approval_count})
            </Link>
          )}

          {/* No Reports Button */}
          {isConfirmedNoReports ? (
            <div
              className="h-7.5 rounded-lg bg-emerald-700 text-white font-bold text-xs px-2.5 flex items-center justify-center gap-1 border border-emerald-800 shadow-2xs select-none"
              title={`Confirmed zero reports by ${row.confirmation?.confirmed_by || "staff"}`}
            >
              <CheckCircle2 className="size-3 text-white" />
              <span>✓ No Reports</span>
            </div>
          ) : canAttestNoReports ? (
            <button
              type="button"
              onClick={() => requestConfirmation(row, "NO_REPORTS_RECEIVED")}
              disabled={confirmationMutation.isPending}
              className="h-7.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-2.5 flex items-center justify-center gap-1 border border-slate-300 hover:border-slate-400 shadow-2xs active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              title="Attest that zero disease/mortality cases occurred this month"
            >
              {isPendingNoReports ? (
                <>
                  <RefreshCw className="size-3 animate-spin text-slate-600" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>No Reports</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast.warning(
                  `Cannot attest zero reports: ${row.record_count} ${domain === "DISEASE" ? "disease" : "mortality"} report${row.record_count === 1 ? " is" : "s are"} already recorded for ${row.barangay_name} in ${formatReportMonth(reportMonth)}.`,
                  { toasterId: "incoming-notifications" }
                );
              }}
              className="h-7.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold text-xs px-2.5 flex items-center justify-center border border-slate-200/80 cursor-pointer transition-colors shadow-2xs"
              title="Click to view why zero reports cannot be attested"
            >
              <span>No Reports</span>
            </button>
          )}

          {/* Complete Button */}
          {isConfirmedAllEntered ? (
            <div
              className="h-7.5 rounded-lg bg-emerald-50 text-emerald-900 font-bold text-xs px-2.5 flex items-center justify-center gap-1 border border-emerald-300 shadow-2xs select-none"
              title={`Confirmed all reports complete by ${row.confirmation?.confirmed_by || "staff"}`}
            >
              <CheckCircle2 className="size-3 text-emerald-800" />
              <span>✓ Complete</span>
            </div>
          ) : canAttestAllEntered ? (
            <button
              type="button"
              onClick={() => requestConfirmation(row, "REPORTS_COMPLETE")}
              disabled={confirmationMutation.isPending}
              className="h-7.5 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-xs px-3 flex items-center justify-center gap-1 border border-[#163b21] shadow-2xs active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              title="Attest that all field reports are submitted and approved"
            >
              {isPendingAllEntered ? (
                <>
                  <RefreshCw className="size-3 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Complete</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (row.needs_approval_count > 0) {
                  toast.error(
                    `Cannot complete monthly attestation: ${row.needs_approval_count} ${domain === "DISEASE" ? "disease" : "mortality"} report${row.needs_approval_count === 1 ? " is" : "s are"} still pending review for ${row.barangay_name}.`,
                    {
                      description: `All reports for ${formatReportMonth(reportMonth)} must be reviewed and approved by MAO before this month can be marked complete.`,
                      toasterId: "incoming-notifications",
                      action: {
                        label: `Review (${row.needs_approval_count})`,
                        onClick: () => {
                          window.location.href = recordsHrefFor(row.barangay_name);
                        },
                      },
                    }
                  );
                } else if (row.record_count === 0) {
                  toast.info(
                    `Zero reports recorded for ${row.barangay_name} in ${formatReportMonth(reportMonth)}. Click "Attest No Reports" to confirm this quiet month.`,
                    { toasterId: "incoming-notifications" }
                  );
                }
              }}
              className="h-7.5 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 text-slate-500 font-bold text-xs px-2.5 flex items-center justify-center border border-slate-200/80 cursor-pointer transition-colors shadow-2xs"
              title="Click to view why completion is blocked"
            >
              <span>Complete</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function SurveillanceCoveragePanel() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { user } = useAuth();
  const isSibatContext = pathname === "/sibat-alerts" || user?.role === "SIBAT" || user?.role === "CBAT";

  const [domain, setDomain] = useState<CoverageDomain>("DISEASE");
  const [reportMonth, setReportMonth] = useState(previousMonthValue);
  const [filterMode, setFilterMode] = useState<"ALL" | "UNCONFIRMED" | "CONFIRMED">("ALL");
  const [viewMode, setViewMode] = useState<CoverageViewMode>("LIST");
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingCoverageConfirmation | null>(null);

  const coverageQuery = useQuery<CoverageResponse>({
    queryKey: ["surveillance-coverage", domain, reportMonth],
    enabled: Boolean(reportMonth),
    queryFn: async () => {
      const response = await api.get<CoverageResponse>("analytics/surveillance-coverage/", {
        params: { domain, report_month: reportMonth },
      });
      return response.data;
    },
  });

  const confirmationMutation = useMutation({
    mutationFn: async (input: CoverageConfirmationRequest) => {
      await api.post("analytics/surveillance-coverage/", {
        ...input,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["surveillance-coverage"],
      });
      toast.success("Monthly reporting coverage confirmed.");
    },
    onError: () => toast.error("Coverage could not be confirmed. Refresh and check the report counts."),
  });

  const requestConfirmation = (row: CoverageBarangay, status: ConfirmationStatus) => {
    setPendingConfirmation({
      barangay_id: row.barangay_id,
      barangay_name: row.barangay_name,
      status,
      domain,
      report_month: reportMonth,
    });
  };

  const recordsHrefFor = (barangayName: string) => {
    if (pathname === "/sibat-alerts") {
      return `/sibat-alerts?type=${domain}&search=${encodeURIComponent(barangayName)}&month=${reportMonth}&status=UNAPPROVED`;
    }

    const recordTab = domain === "MORTALITY" ? "mortality" : "disease";
    return `/disease-mortality?tab=${recordTab}&barangay=${encodeURIComponent(barangayName)}&month=${reportMonth}&status=UNAPPROVED`;
  };

  const rawRows = coverageQuery.data?.barangays ?? [];
  const rows = useMemo(() => {
    if (!isSibatContext) return rawRows;

    const assignedName = user?.assignedBarangayName || user?.barangay;
    const assignedId = user?.assignedBarangayId;

    if (assignedName || assignedId) {
      const filtered = rawRows.filter((r) => {
        if (assignedId && r.barangay_id === assignedId) return true;
        if (assignedName && r.barangay_name.trim().toLowerCase() === assignedName.trim().toLowerCase()) return true;
        return false;
      });
      if (filtered.length > 0) return filtered;
    }

    return rawRows;
  }, [rawRows, isSibatContext, user?.assignedBarangayName, user?.assignedBarangayId, user?.barangay]);
  const isSingleBarangay = rows.length === 1;
  const singleRow = isSingleBarangay ? rows[0] : null;
  const confirmedCount = rows.filter((r) => r.state === "CONFIRMED").length;
  const unconfirmedCount = rows.filter((r) => r.state === "UNCONFIRMED").length;
  const staleCount = rows.filter((r) => r.state === "STALE" || r.state === "INCONSISTENT").length;
  const totalNeedsApproval = rows.reduce((sum, r) => sum + (r.needs_approval_count || 0), 0);
  const unapprovedBarangays = rows.filter((r) => r.needs_approval_count > 0);

  const displayRows = rows.filter((r) => {
    if (isSingleBarangay) return true;
    if (filterMode === "UNCONFIRMED") return r.state !== "CONFIRMED";
    if (filterMode === "CONFIRMED") return r.state === "CONFIRMED";
    return true;
  });

  return (
    <>
      {coverageQuery.isPending ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-slate-500">
            <RefreshCw className="size-4 animate-spin text-emerald-600" /> Loading authorized barangays…
          </div>
        </section>
      ) : coverageQuery.isError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          Coverage could not be loaded. Refresh the page or check your account’s barangay access.
        </section>
      ) : isSingleBarangay && singleRow ? (
        <CompactSingleBarangayCard
          row={singleRow}
          domain={domain}
          reportMonth={reportMonth}
          setDomain={setDomain}
          setReportMonth={setReportMonth}
          confirmationMutation={confirmationMutation}
          requestConfirmation={requestConfirmation}
          recordsHrefFor={recordsHrefFor}
        />
      ) : (
        <section className="rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs sm:p-5" aria-labelledby="surveillance-coverage-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <h2 id="surveillance-coverage-title" className="text-base font-bold text-slate-900">
                  Monthly Reporting Coverage
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                  Confirm whether each authorized barangay had no reports or all reports entered. Forecasts count a quiet month as zero only after this confirmation; reported months also wait for approval.
                </p>
              </div>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              Reporting month:
              <input
                type="month"
                value={reportMonth}
                max={previousMonthValue()}
                onChange={(event) => setReportMonth(event.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800"
              />
            </label>
          </div>

          {/* Toolbar: Domain Selector & Quick Status Filter */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Domain Toggles */}
            <div className="flex items-center gap-2" role="group" aria-label="Reporting domain">
              <span className="text-xs font-bold text-slate-500 mr-1">Domain:</span>
              {(["DISEASE", "MORTALITY"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={domain === item}
                  onClick={() => setDomain(item)}
                  className={`h-8 rounded-xl px-3 text-xs font-bold transition-all cursor-pointer ${
                    domain === item
                      ? "bg-[#1E4D2B] text-white shadow-xs ring-1 ring-emerald-950/20"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item === "DISEASE" ? "Disease Reports" : "Mortality Records"}
                </button>
              ))}
            </div>

            {/* Status Filter Tabs */}
            {rows.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterMode("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    filterMode === "ALL"
                      ? "bg-slate-800 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All ({rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("CONFIRMED")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    filterMode === "CONFIRMED"
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Confirmed ({confirmedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("UNCONFIRMED")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    filterMode === "UNCONFIRMED"
                      ? "bg-amber-700 text-white shadow-2xs"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Pending Action ({unconfirmedCount + staleCount})
                </button>
              </div>
            )}

            <CoverageViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>

          <div className="mt-4 space-y-3">
            {/* Unfinished reports notification banner across authorized municipal barangays */}
            {totalNeedsApproval > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">
                    <CircleHelp className="size-5 text-amber-700" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-amber-950">
                      Unfinished Field Reports Pending MAO Review
                    </h3>
                    <p className="text-xs text-amber-900/90 mt-0.5">
                      {totalNeedsApproval} {domain === "DISEASE" ? "disease" : "mortality"} report{totalNeedsApproval === 1 ? "" : "s"} across {unapprovedBarangays.length} barangay{unapprovedBarangays.length === 1 ? "" : "s"} ({unapprovedBarangays.map((b) => b.barangay_name).join(", ")}) must be reviewed and approved by MAO before coverage can be marked complete.
                    </p>
                  </div>
                </div>
                <Link
                  href={recordsHrefFor(unapprovedBarangays[0]?.barangay_name || "")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100 shrink-0 transition-colors"
                >
                  <span>Review {totalNeedsApproval} Unapproved Report{totalNeedsApproval === 1 ? "" : "s"}</span>
                  <ArrowRight className="size-3.5 text-amber-700" />
                </Link>
              </div>
            )}

            {coverageQuery.data?.unassigned_record_count ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <CircleHelp className="mt-0.5 size-4 shrink-0" />
                {coverageQuery.data.unassigned_record_count} report(s) for this month have no barangay link. They must be assigned before they can be included in a forecast.
              </div>
            ) : null}

            {displayRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
                {rows.length === 0
                  ? "No barangays are available in your authorized scope."
                  : "No barangays matched your active filter."}
              </div>
            ) : (
              <div className={viewMode === "GRID" ? "grid auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5" : "flex flex-col gap-2.5"}>
              {displayRows.map((row) => {
                const isConfirmed = row.state === "CONFIRMED";
                const isStale = row.state === "STALE" || row.state === "INCONSISTENT";

                const isConfirmedNoReports = isConfirmed && row.confirmation?.status === "NO_REPORTS_RECEIVED";
                const isConfirmedAllEntered = isConfirmed && row.confirmation?.status === "REPORTS_COMPLETE";

                const isPendingNoReports =
                  confirmationMutation.isPending &&
                  confirmationMutation.variables?.barangay_id === row.barangay_id &&
                  confirmationMutation.variables?.status === "NO_REPORTS_RECEIVED";

                const isPendingAllEntered =
                  confirmationMutation.isPending &&
                  confirmationMutation.variables?.barangay_id === row.barangay_id &&
                  confirmationMutation.variables?.status === "REPORTS_COMPLETE";

                const canAttestNoReports =
                  row.can_confirm_no_reports && !isConfirmedNoReports && !confirmationMutation.isPending;

                const canAttestAllEntered =
                  row.can_confirm_reports_complete &&
                  row.record_count > 0 &&
                  row.approved_record_count === row.record_count &&
                  !isConfirmedAllEntered &&
                  !confirmationMutation.isPending;

                return (
                  <div
                    key={row.barangay_id}
                    className={`${
                      viewMode === "GRID"
                        ? "flex flex-col justify-between rounded-2xl p-4"
                        : "flex flex-col gap-3 rounded-xl px-4 py-3 sm:min-h-[60px] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    } border transition-all duration-150 ${
                      isConfirmed
                        ? "border-emerald-200/90 bg-emerald-50 shadow-2xs hover:border-emerald-300"
                        : isStale
                        ? "border-rose-200 bg-rose-50/25 shadow-2xs hover:border-rose-300"
                        : "border-slate-200/90 bg-white shadow-2xs hover:border-slate-300"
                    }`}
                  >
                    {/* Card Header: Title + Status Badge */}
                    <div
                      className={
                        viewMode === "LIST"
                          ? "flex items-center justify-between gap-3 sm:w-56 sm:shrink-0"
                          : "flex items-start justify-between gap-2"
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-slate-900 text-sm truncate" title={row.barangay_name}>
                          {row.barangay_name}
                        </h3>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
                          {row.record_count === 0 ? "0 field reports" : `${row.record_count} total report${row.record_count === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                          isConfirmed
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300/80"
                            : isStale
                            ? "bg-rose-100 text-rose-800 border border-rose-300/80"
                            : "bg-amber-100 text-amber-800 border border-amber-300/80"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            isConfirmed ? "bg-emerald-500" : isStale ? "bg-rose-500" : "bg-amber-500"
                          }`}
                        />
                        {stateLabel(row.state)}
                      </span>
                    </div>

                    {/* Card Body: Breakdown metrics */}
                    <div
                      className={
                        viewMode === "GRID"
                          ? "my-3 space-y-1 rounded-xl bg-slate-50/90 p-2.5 text-[11px] border border-slate-100"
                          : "flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 pt-2 text-[11px] sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"
                      }
                    >
                      <div className={viewMode === "GRID" ? "flex items-center justify-between" : "flex items-center gap-1.5"}>
                        <span className="text-slate-500">Approved records:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {row.approved_record_count} / {row.record_count}
                        </span>
                      </div>
                      {row.needs_approval_count > 0 && (
                        <div className={viewMode === "GRID" ? "flex items-center justify-between text-amber-700 font-bold" : "flex items-center gap-1.5 text-amber-700 font-bold"}>
                          <span>Not approved:</span>
                          <span className="font-mono">{row.needs_approval_count}</span>
                        </div>
                      )}
                      {row.confirmation ? (
                        <div
                          className={
                            viewMode === "GRID"
                              ? "text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/60 leading-snug truncate"
                              : "text-[11px] text-slate-500 leading-snug"
                          }
                        >
                          Confirmed {row.confirmation.status === "NO_REPORTS_RECEIVED" ? "zero reports" : "complete"} by{" "}
                          <span className="font-bold text-slate-700">{row.confirmation.confirmed_by}</span>
                        </div>
                      ) : (
                        <div
                          className={
                            viewMode === "GRID"
                              ? "text-[10px] text-slate-400 italic pt-1.5 border-t border-slate-200/60"
                              : "text-[11px] text-slate-400 italic"
                          }
                        >
                          No monthly attestation yet
                        </div>
                      )}
                    </div>

                    {/* Card Actions: 2 high-contrast, crystal-clear buttons */}
                    <div
                      className={
                        viewMode === "GRID"
                          ? "grid grid-cols-2 gap-2 pt-2 border-t border-slate-100"
                          : "flex items-center justify-end gap-2 border-t border-slate-100 pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 shrink-0"
                      }
                    >
                      {/* In LIST view, Review button appears inline so row height remains uniform */}
                      {viewMode === "LIST" && row.needs_approval_count > 0 && (
                        <Link
                          href={recordsHrefFor(row.barangay_name)}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-[11px] font-bold text-amber-900 transition-colors hover:bg-amber-100 shadow-2xs shrink-0"
                          title={`Review ${row.needs_approval_count} unapproved report${row.needs_approval_count === 1 ? "" : "s"}`}
                        >
                          <ArrowRight className="size-3.5 shrink-0 text-amber-700" />
                          <span>Review ({row.needs_approval_count})</span>
                        </Link>
                      )}

                      {/* Left Action: No Reports */}
                      {isConfirmedNoReports ? (
                        <div
                          className="h-8 rounded-lg bg-emerald-700 text-white font-bold text-[11px] px-3 flex items-center justify-center gap-1.5 border border-emerald-800 shadow-2xs select-none truncate"
                          title={`Confirmed zero reports by ${row.confirmation?.confirmed_by || "staff"}`}
                        >
                          <CheckCircle2 className="size-3.5 shrink-0 text-white" />
                          <span className="truncate">✓ No Reports</span>
                        </div>
                      ) : canAttestNoReports ? (
                        <button
                          type="button"
                          onClick={() => requestConfirmation(row, "NO_REPORTS_RECEIVED")}
                          disabled={confirmationMutation.isPending}
                          className="h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] px-3 flex items-center justify-center gap-1.5 border border-slate-300 hover:border-slate-400 shadow-2xs active:scale-98 transition-all cursor-pointer truncate disabled:opacity-50"
                          title="Attest that zero disease/mortality cases occurred this month"
                        >
                          {isPendingNoReports ? (
                            <>
                              <RefreshCw className="size-3 shrink-0 animate-spin text-slate-600" />
                              <span className="truncate">Saving...</span>
                            </>
                          ) : (
                            <span className="truncate">No Reports</span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            toast.warning(
                              `Cannot attest zero reports: ${row.record_count} ${domain === "DISEASE" ? "disease" : "mortality"} report${row.record_count === 1 ? " is" : "s are"} already recorded for ${row.barangay_name}.`,
                              { toasterId: "incoming-notifications" }
                            );
                          }}
                          className="h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold text-[11px] px-3 flex items-center justify-center border border-slate-200/80 cursor-pointer select-none truncate transition-colors"
                          title="Click to view why zero reports cannot be attested"
                        >
                          <span className="truncate">No Reports</span>
                        </button>
                      )}

                      {/* Right Action: Complete */}
                      {isConfirmedAllEntered ? (
                        <div
                          className="h-8 rounded-lg bg-emerald-50 text-emerald-900 font-bold text-[11px] px-3 flex items-center justify-center gap-1.5 border border-emerald-300 shadow-2xs select-none truncate"
                          title={`Confirmed all reports complete by ${row.confirmation?.confirmed_by || "staff"}`}
                        >
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-800" />
                          <span className="truncate">✓ Completed</span>
                        </div>
                      ) : canAttestAllEntered ? (
                        <button
                          type="button"
                          onClick={() => requestConfirmation(row, "REPORTS_COMPLETE")}
                          disabled={confirmationMutation.isPending}
                          className="h-8 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-[11px] px-3 flex items-center justify-center gap-1.5 border border-[#163b21] shadow-2xs active:scale-98 transition-all cursor-pointer truncate disabled:opacity-50"
                          title="Attest that all field reports are submitted and approved"
                        >
                          {isPendingAllEntered ? (
                            <>
                              <RefreshCw className="size-3 shrink-0 animate-spin text-white" />
                              <span className="truncate">Saving...</span>
                            </>
                          ) : (
                            <span className="truncate">Complete</span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.needs_approval_count > 0) {
                              toast.error(
                                `Cannot complete monthly attestation: ${row.needs_approval_count} ${domain === "DISEASE" ? "disease" : "mortality"} report${row.needs_approval_count === 1 ? " is" : "s are"} still pending review for ${row.barangay_name}.`,
                                {
                                  description: `All reports for ${formatReportMonth(reportMonth)} must be reviewed and approved by MAO before this month can be marked complete.`,
                                  toasterId: "incoming-notifications",
                                  action: {
                                    label: `Review (${row.needs_approval_count})`,
                                    onClick: () => {
                                      window.location.href = recordsHrefFor(row.barangay_name);
                                    },
                                  },
                                }
                              );
                            } else if (row.record_count === 0) {
                              toast.info(
                                `Zero reports recorded for ${row.barangay_name} in ${formatReportMonth(reportMonth)}. Click "No Reports" to confirm this quiet month.`,
                                { toasterId: "incoming-notifications" }
                              );
                            }
                          }}
                          className="h-8 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 text-slate-500 font-bold text-[11px] px-3 flex items-center justify-center border border-slate-200/80 cursor-pointer select-none truncate transition-colors shadow-2xs"
                          title="Click to view why completion is blocked"
                        >
                          <span className="truncate">Complete</span>
                        </button>
                      )}

                      {/* In GRID view only, Review button spans 2 columns at the bottom of the card */}
                      {viewMode === "GRID" && row.needs_approval_count > 0 && (
                        <Link
                          href={recordsHrefFor(row.barangay_name)}
                          className="col-span-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[11px] font-bold text-amber-900 transition-colors hover:bg-amber-100"
                        >
                          <ArrowRight className="size-3.5 shrink-0" />
                          Review {row.needs_approval_count} unapproved report{row.needs_approval_count === 1 ? "" : "s"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    )}

      <AlertDialog
        open={pendingConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirmation(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              {pendingConfirmation?.status === "NO_REPORTS_RECEIVED"
                ? "Confirm no reports?"
                : "Mark reports complete?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-5 text-slate-600">
              {pendingConfirmation?.status === "NO_REPORTS_RECEIVED" ? (
                <>
                  Are you sure no {pendingConfirmation.domain === "DISEASE" ? "disease" : "mortality"} reports were received for {pendingConfirmation.barangay_name} in {pendingConfirmation.report_month}? This attestation is saved in the audit history and allows forecasting to treat the month as zero. It cannot be deleted; any correction will be recorded as another confirmation.
                </>
              ) : pendingConfirmation ? (
                <>
                  Are you sure all known {pendingConfirmation.domain === "DISEASE" ? "disease" : "mortality"} reports for {pendingConfirmation.barangay_name} in {pendingConfirmation.report_month} have been entered and approved? This attestation is saved in the audit history. Forecasting also requires review timestamps for every report. It cannot be deleted; any correction will be recorded as another confirmation.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-9 text-xs"
              onClick={(event) => {
                event.preventDefault();
                if (!pendingConfirmation) return;
                const { barangay_id, status, domain: selectedDomain, report_month } = pendingConfirmation;
                confirmationMutation.mutate({
                  barangay_id,
                  status,
                  domain: selectedDomain,
                  report_month,
                });
                setPendingConfirmation(null);
              }}
            >
              {pendingConfirmation?.status === "NO_REPORTS_RECEIVED"
                ? "Confirm no reports"
                : "Confirm complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
