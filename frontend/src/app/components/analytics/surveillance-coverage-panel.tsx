"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import api from "@/lib/axios";

type CoverageDomain = "DISEASE" | "MORTALITY";
type ConfirmationStatus = "NO_REPORTS_RECEIVED" | "REPORTS_COMPLETE";

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

export function SurveillanceCoveragePanel() {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState<CoverageDomain>("DISEASE");
  const [reportMonth, setReportMonth] = useState(previousMonthValue);
  const [filterMode, setFilterMode] = useState<"ALL" | "UNCONFIRMED" | "CONFIRMED">("ALL");

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
    mutationFn: async (input: { barangay_id: number; status: ConfirmationStatus }) => {
      await api.post("analytics/surveillance-coverage/", {
        ...input,
        domain,
        report_month: reportMonth,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["surveillance-coverage", domain, reportMonth] });
      toast.success("Monthly reporting coverage confirmed.");
    },
    onError: () => toast.error("Coverage could not be confirmed. Refresh and check the report counts."),
  });

  const rows = coverageQuery.data?.barangays ?? [];
  const confirmedCount = rows.filter((r) => r.state === "CONFIRMED").length;
  const unconfirmedCount = rows.filter((r) => r.state === "UNCONFIRMED").length;
  const staleCount = rows.filter((r) => r.state === "STALE" || r.state === "INCONSISTENT").length;

  const displayRows = rows.filter((r) => {
    if (filterMode === "UNCONFIRMED") return r.state !== "CONFIRMED";
    if (filterMode === "CONFIRMED") return r.state === "CONFIRMED";
    return true;
  });

  return (
    <section className="rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs sm:p-5" aria-labelledby="surveillance-coverage-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <h2 id="surveillance-coverage-title" className="text-base font-bold text-slate-900">
              Monthly Reporting Coverage Matrix
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
        {rows.length > 0 && (
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
      </div>

      {coverageQuery.isPending ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <RefreshCw className="size-4 animate-spin text-emerald-600" /> Loading authorized barangays…
        </div>
      ) : coverageQuery.isError ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Coverage could not be loaded. Refresh the page or check your account’s barangay access.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
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
                  row.can_confirm_reports_complete && !isConfirmedAllEntered && !confirmationMutation.isPending;

                return (
                  <div
                    key={row.barangay_id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 transition-all duration-150 ${
                      isConfirmed
                        ? "border-emerald-200/90 bg-emerald-50/20 shadow-2xs hover:border-emerald-300"
                        : isStale
                        ? "border-rose-200 bg-rose-50/25 shadow-2xs hover:border-rose-300"
                        : "border-slate-200/90 bg-white shadow-2xs hover:border-slate-300"
                    }`}
                  >
                    {/* Card Header: Title + Status Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-slate-900 text-sm truncate" title={row.barangay_name}>
                            {row.barangay_name}
                          </h3>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
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
                      <div className="my-3 space-y-1 rounded-xl bg-slate-50/90 p-2.5 text-[11px] border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Approved records:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {row.approved_record_count} / {row.record_count}
                          </span>
                        </div>
                        {row.needs_approval_count > 0 && (
                          <div className="flex items-center justify-between text-amber-700 font-bold">
                            <span>Awaiting review:</span>
                            <span className="font-mono">{row.needs_approval_count}</span>
                          </div>
                        )}
                        {row.confirmation ? (
                          <div className="text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/60 leading-snug truncate">
                            Confirmed {row.confirmation.status === "NO_REPORTS_RECEIVED" ? "zero reports" : "complete"} by <span className="font-bold text-slate-700">{row.confirmation.confirmed_by}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic pt-1.5 border-t border-slate-200/60">
                            No monthly attestation yet
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions: 2 high-contrast, crystal-clear buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      {/* Left Action: No Reports */}
                      {isConfirmedNoReports ? (
                        <div
                          className="h-8 rounded-lg bg-emerald-700 text-white font-bold text-[11px] px-2 flex items-center justify-center gap-1.5 border border-emerald-800 shadow-2xs select-none truncate"
                          title={`Confirmed zero reports by ${row.confirmation?.confirmed_by || "staff"}`}
                        >
                          <CheckCircle2 className="size-3.5 shrink-0 text-white" />
                          <span className="truncate">✓ No Reports</span>
                        </div>
                      ) : canAttestNoReports ? (
                        <button
                          type="button"
                          onClick={() => confirmationMutation.mutate({ barangay_id: row.barangay_id, status: "NO_REPORTS_RECEIVED" })}
                          disabled={confirmationMutation.isPending}
                          className="h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] px-2 flex items-center justify-center gap-1.5 border border-slate-300 hover:border-slate-400 shadow-2xs active:scale-98 transition-all cursor-pointer truncate disabled:opacity-50"
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
                        <div
                          className="h-8 rounded-lg bg-slate-100 text-slate-500 font-semibold text-[11px] px-2 flex items-center justify-center border border-slate-200/80 cursor-not-allowed select-none truncate"
                          title="Cannot attest zero reports: field records already exist"
                        >
                          <span className="truncate">No Reports</span>
                        </div>
                      )}

                      {/* Right Action: All Entered */}
                      {isConfirmedAllEntered ? (
                        <div
                          className="h-8 rounded-lg bg-[#1E4D2B] text-white font-bold text-[11px] px-2 flex items-center justify-center gap-1.5 border border-[#163b21] shadow-2xs select-none truncate"
                          title={`Confirmed all reports complete by ${row.confirmation?.confirmed_by || "staff"}`}
                        >
                          <CheckCircle2 className="size-3.5 shrink-0 text-white" />
                          <span className="truncate">✓ All Entered</span>
                        </div>
                      ) : canAttestAllEntered ? (
                        <button
                          type="button"
                          onClick={() => confirmationMutation.mutate({ barangay_id: row.barangay_id, status: "REPORTS_COMPLETE" })}
                          disabled={confirmationMutation.isPending}
                          className="h-8 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-[11px] px-2 flex items-center justify-center gap-1.5 border border-[#163b21] shadow-2xs active:scale-98 transition-all cursor-pointer truncate disabled:opacity-50"
                          title="Attest that all field reports are submitted and approved"
                        >
                          {isPendingAllEntered ? (
                            <>
                              <RefreshCw className="size-3 shrink-0 animate-spin text-white" />
                              <span className="truncate">Saving...</span>
                            </>
                          ) : (
                            <span className="truncate">All Entered</span>
                          )}
                        </button>
                      ) : (
                        <div
                          className="h-8 rounded-lg bg-slate-100 text-slate-500 font-semibold text-[11px] px-2 flex items-center justify-center border border-slate-200/80 cursor-not-allowed select-none truncate"
                          title={
                            row.record_count === 0
                              ? "Cannot confirm complete: zero records exist"
                              : "Cannot confirm complete: pending approval"
                          }
                        >
                          <span className="truncate">All Entered</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
