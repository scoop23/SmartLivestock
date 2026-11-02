"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

  return (
    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-2xs sm:p-5" aria-labelledby="surveillance-coverage-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <h2 id="surveillance-coverage-title" className="text-base font-bold text-slate-900">
              Monthly reporting coverage
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
              Confirm whether each authorized barangay had no reports or all reports entered. Forecasts count a quiet month as zero only after this confirmation; reported months also wait for approval.
            </p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
          Reporting month
          <input
            type="month"
            value={reportMonth}
            max={previousMonthValue()}
            onChange={(event) => setReportMonth(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Reporting domain">
        {(["DISEASE", "MORTALITY"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={domain === item}
            onClick={() => setDomain(item)}
            className={`h-8 rounded-lg border px-3 text-xs font-bold transition-colors ${domain === item ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {item === "DISEASE" ? "Disease" : "Mortality"}
          </button>
        ))}
      </div>

      {coverageQuery.isPending ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <RefreshCw className="size-4 animate-spin" /> Loading authorized barangays…
        </div>
      ) : coverageQuery.isError ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Coverage could not be loaded. Refresh the page or check your account’s barangay access.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {coverageQuery.data?.unassigned_record_count ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <CircleHelp className="mt-0.5 size-4 shrink-0" />
              {coverageQuery.data.unassigned_record_count} report(s) for this month have no barangay link. They must be assigned before they can be included in a forecast.
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No barangays are available in your authorized scope.</p>
          ) : rows.map((row) => {
            const sameConfirmation = row.state === "CONFIRMED";
            const noReportsDisabled = !row.can_confirm_no_reports || confirmationMutation.isPending || (sameConfirmation && row.confirmation?.status === "NO_REPORTS_RECEIVED");
            const allEnteredDisabled = !row.can_confirm_reports_complete || confirmationMutation.isPending || (sameConfirmation && row.confirmation?.status === "REPORTS_COMPLETE");

            return (
              <div key={row.barangay_id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-slate-900">{row.barangay_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.state === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : row.state === "UNCONFIRMED" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>
                      {stateLabel(row.state)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {row.record_count} report(s) · {row.approved_record_count} approved
                    {row.needs_approval_count > 0 ? ` · ${row.needs_approval_count} waiting for approval` : ""}
                  </p>
                  {row.confirmation ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Last confirmed {row.confirmation.status === "NO_REPORTS_RECEIVED" ? "no reports" : "all reports entered"} by {row.confirmation.confirmed_by}.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={noReportsDisabled}
                    onClick={() => confirmationMutation.mutate({ barangay_id: row.barangay_id, status: "NO_REPORTS_RECEIVED" })}
                    className="h-8 text-[11px]"
                  >
                    Confirm no reports
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={allEnteredDisabled}
                    onClick={() => confirmationMutation.mutate({ barangay_id: row.barangay_id, status: "REPORTS_COMPLETE" })}
                    className="h-8 text-[11px]"
                  >
                    Confirm all entered
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
