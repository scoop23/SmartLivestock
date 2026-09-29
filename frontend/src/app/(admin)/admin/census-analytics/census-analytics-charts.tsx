"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, ClipboardList, MapPinOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  censusStatusMeta,
  type CensusAnalytics,
} from "./census-analytics";

interface CensusAnalyticsChartsProps {
  data: CensusAnalytics;
}

export function CensusAnalyticsCharts({ data }: CensusAnalyticsChartsProps) {
  const { heads_by_barangay, status_by_barangay, coverage, period } = data;

  // Only statuses that actually have submissions are charted, so the pie never
  // shows invented "0" slices. The empty states are stated in text instead.
  const statusSlices = status_by_barangay
    .filter((row) => row.submissions > 0)
    .map((row) => ({
      name: row.status,
      value: row.submissions,
      color: censusStatusMeta(row.status).color,
    }));

  const chartHeight = Math.max(240, heads_by_barangay.length * 42);

  return (
    <div className="space-y-3.5">
      {/* ── CHART 1: Heads reported per barangay ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-[#2D5A27]" />
            Census Heads by Barangay
          </h3>
          <Badge
            variant="outline"
            className="text-[9px] font-black uppercase tracking-wider text-slate-600 bg-slate-50 border-slate-200"
          >
            {period.label}
          </Badge>
        </div>
        <p className="text-[11px] text-slate-500 font-medium mb-3">
          Livestock heads tallied in submitted census batches —{" "}
          {coverage.submitted} of {coverage.total_barangays} barangays reported
        </p>

        {heads_by_barangay.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <MapPinOff className="size-7 text-slate-300" />
            <p className="text-xs font-black text-slate-600">
              No census batches recorded for {period.label}
            </p>
            <p className="text-[11px] text-slate-500 font-medium max-w-sm">
              Nothing has been submitted yet for this quarter. Once SIBAT files
              a batch for a barangay it will appear here with its head count.
            </p>
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <BarChart
                data={heads_by_barangay}
                layout="vertical"
                margin={{ top: 4, right: 42, bottom: 4, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="barangay"
                  width={104}
                  tick={{ fontSize: 11, fill: "#334155", fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                  labelFormatter={(label) => `Brgy. ${label}`}
                  formatter={(value) => [
                    `${Number(value).toLocaleString()} heads`,
                    "Heads reported",
                  ]}
                />
                <Bar
                  dataKey="heads"
                  fill="#2D5A27"
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                  name="Heads"
                >
                  <LabelList
                    dataKey="heads"
                    position="right"
                    style={{ fontSize: 10, fontWeight: 800, fill: "#334155" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {heads_by_barangay.length > 0 && (
          <div className="pt-2.5 border-t border-slate-100 mt-2 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>
              {data.totals.farmers} farmer
              {data.totals.farmers === 1 ? "" : "s"} counted across{" "}
              {data.totals.submissions} batch
              {data.totals.submissions === 1 ? "" : "es"}
            </span>
            <span className="text-[#2D5A27] font-bold">
              {data.totals.heads.toLocaleString()} heads reported
            </span>
          </div>
        )}
      </div>

      {/* ── CHART 2: Submission status coverage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <div className="lg:col-span-5 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
          <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2D5A27]" />
            Submission Status
          </h3>
          <p className="text-[11px] text-slate-500 font-medium mb-2">
            Where each submitted batch currently sits in the SIBAT &rarr; MAO
            workflow
          </p>

          {statusSlices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <MapPinOff className="size-6 text-slate-300" />
              <p className="text-xs font-black text-slate-600">
                No batches to review
              </p>
            </div>
          ) : (
            <>
              <div className="h-[184px]">
                <ResponsiveContainer width="100%" height="100%" debounce={150}>
                  <PieChart>
                    <Pie
                      data={statusSlices}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={46}
                      outerRadius={74}
                      paddingAngle={3}
                      strokeWidth={2}
                      stroke="#ffffff"
                    >
                      {statusSlices.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                      formatter={(value, name) => [
                        `${Number(value)} batch${Number(value) === 1 ? "" : "es"}`,
                        censusStatusMeta(String(name)).label,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 space-y-1.5">
                {statusSlices.map((slice) => {
                  const meta = censusStatusMeta(slice.name);
                  return (
                    <div
                      key={slice.name}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span className="font-black text-slate-900">
                        {slice.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Awaiting-submission list — the census coverage story in plain text */}
        <div className="lg:col-span-7 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Awaiting Submission
            </h3>
            <Badge
              variant="outline"
              className="text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 border-amber-200"
            >
              {coverage.missing} of {coverage.total_barangays} missing
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mb-3">
            Barangays with no census batch on file for {period.label}
          </p>

          {coverage.missing_barangays.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CheckCircle2 className="size-7 text-emerald-500" />
              <p className="text-xs font-black text-emerald-800">
                Full municipal coverage
              </p>
              <p className="text-[11px] text-slate-500 font-medium max-w-sm">
                All {coverage.total_barangays} barangays have submitted a
                census batch for {period.label}.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {coverage.missing_barangays.map((barangay) => (
                <span
                  key={barangay}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700"
                >
                  Brgy. {barangay}
                </span>
              ))}
            </div>
          )}

          <div className="pt-2.5 border-t border-slate-100 mt-auto flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>Census coverage for {period.label}</span>
            <span className="text-[#2D5A27] font-bold">
              {coverage.submission_pct}% of barangays
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CensusAnalyticsCharts;
