"use client";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ClipboardCheck, Clock3, RotateCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReviewWorkload } from "./review-workload";

export function ReviewWorkloadPanel({ scopeLabel, hideMaoQueue = false }: { scopeLabel?: string; hideMaoQueue?: boolean } = {}) {
  const { user } = useAuth();
  const { data, isLoading, isError, isFetching, refetch } = useReviewWorkload();
  const isCbat = user?.role === "CBAT";
  const chartData = isCbat && data?.by_domain
    ? data.by_domain.filter((domain) => domain.key !== "disease")
    : data?.by_domain;
  const agingBuckets = [
    { key: "under_3_days", label: "0-2 days" },
    { key: "3_to_7_days", label: "3-7 days" },
    { key: "over_7_days", label: "Over 7 days" },
  ] as const;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:p-4" aria-label="Review workload">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-black tracking-tight text-slate-900">
            <ClipboardCheck className="size-4 text-[#2D5A27]" /> Review Workload
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{scopeLabel ? `${scopeLabel}. ` : ""}Open records by review stage; returned records need submitter corrections.</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Refresh review workload" title="Refresh review workload" onClick={() => refetch()} disabled={isFetching} className="size-8 shrink-0">
          <RotateCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? <p className="py-12 text-center text-sm text-slate-500">Loading review queues…</p> : null}
      {isError ? <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-800">Review workload could not be loaded.</p> : null}
      {data ? <>
        <div className={`mb-3 grid gap-2 ${hideMaoQueue ? "grid-cols-2" : "grid-cols-3"}`}>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">SIBAT queue</p>
            <p className="text-xl font-black text-slate-900">{data.overall.sibat.count.toLocaleString()}</p>
          </div>
          {!hideMaoQueue ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800">MAO queue</p>
            <p className="text-xl font-black text-slate-900">{data.overall.mao.count.toLocaleString()}</p>
          </div>
          ) : null}
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
            <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-rose-800"><AlertTriangle className="size-3" /> Returned</p>
            <p className="text-xl font-black text-slate-900">{data.overall.returned.toLocaleString()}</p>
          </div>
        </div>

        {(data.overall.sibat.count + (hideMaoQueue ? 0 : data.overall.mao.count) + data.overall.returned) > 0 ? <div className="h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 12, left: 4, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
              <YAxis type="category" dataKey="label" width={126} tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value, name) => [Number(value ?? 0).toLocaleString(), String(name)]} />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              <Bar dataKey="sibat_count" name="Awaiting SIBAT" stackId="queue" fill="#f59e0b" />
              {!hideMaoQueue ? <Bar dataKey="mao_count" name="Awaiting MAO" stackId="queue" fill="#0284c7" /> : null}
              <Bar dataKey="returned_count" name="Returned for revision" stackId="queue" fill="#e11d48" />
            </BarChart>
          </ResponsiveContainer>
        </div> : <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">No records are currently waiting for review.</p>}

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700"><Clock3 className="size-3.5 text-slate-500" /> How long records have been waiting</p>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-[13px]" aria-label="Open records grouped by time waiting for review">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2">Waiting time</th>
                  <th scope="col" className="px-3 py-2 text-right">With SIBAT</th>
                  {!hideMaoQueue ? <th scope="col" className="px-3 py-2 text-right">With MAO</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agingBuckets.map((bucket) => {
                  const isOverdue = bucket.key === "over_7_days";
                  const sibatCount = data.overall.sibat.aging[bucket.key];
                  const maoCount = data.overall.mao.aging[bucket.key];

                  return <tr key={bucket.key} className={isOverdue ? "bg-amber-50/70" : "bg-white"}>
                    <th scope="row" className={`px-3 py-2 text-left font-semibold ${isOverdue ? "text-amber-900" : "text-slate-700"}`}>
                      {bucket.label}{isOverdue ? <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-700">Needs attention</span> : null}
                    </th>
                    <td className="px-3 py-2 text-right font-bold text-amber-800">{sibatCount.toLocaleString()} <span className="font-medium text-slate-500">records</span></td>
                    {!hideMaoQueue ? <td className="px-3 py-2 text-right font-bold text-sky-800">{maoCount.toLocaleString()} <span className="font-medium text-slate-500">records</span></td> : null}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{hideMaoQueue ? "Counts show records awaiting SIBAT review and records returned for correction. SIBAT wait starts at submission." : "Counts show open records at each stage. SIBAT wait starts at submission; MAO wait starts at handoff when available."}</p>
        </div>
      </> : null}
    </section>
  );
}

