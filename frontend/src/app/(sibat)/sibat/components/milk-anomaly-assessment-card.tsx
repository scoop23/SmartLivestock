"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  Milk,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import type { UnifiedSubmissionItem } from "../sibat-analytics";

interface MilkAnomalyAssessmentCardProps {
  submission: UnifiedSubmissionItem;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.slice(0, 10));
  if (!match) return dateStr;
  return `${parseInt(match[2], 10)}/${parseInt(match[3], 10)}`;
}

export function MilkAnomalyAssessmentCard({
  submission,
}: MilkAnomalyAssessmentCardProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const assessment = submission.anomalyAssessment;
  if (!assessment) return null;

  const baseline = assessment.historical_baseline;
  const deviation = assessment.deviation;
  const forecast = assessment.forecast_comparison;

  const medianLiters = baseline?.baseline_median_liters ?? null;
  const meanLiters = baseline?.baseline_mean_liters ?? null;
  const currentLiters =
    assessment.submitted_quantity ?? submission.quantity ?? 0;
  const unit = assessment.unit || submission.unit || "L";
  const unitLabel = unit.toLowerCase() === "liters" ? "L" : unit;
  const isSpike = assessment.anomaly_direction === "SPIKE";
  const isDecline = assessment.anomaly_direction === "DECLINE";
  const isClean = submission.anomalyAssessmentStatus === "CLEAN";
  const isInsufficient =
    submission.anomalyAssessmentStatus === "INSUFFICIENT_HISTORY";
  const diffLiters = deviation?.absolute_liters ?? null;
  const diffPct = deviation?.percentage_change ?? null;
  const expectedLiters =
    forecast?.available && forecast.status === "MATCHED"
      ? forecast.expected_liters
      : null;

  // Prepare chart data points
  // Recent daily observations (up to last 12 for wide view)
  const pastObservations = baseline?.recent_observations || [];
  const recentSlice = pastObservations.slice(-12);

  type ChartPoint = {
    dateLabel: string;
    fullDate: string;
    liters: number;
    isToday: boolean;
    difference?: number | null;
  };

  const chartData: ChartPoint[] = recentSlice.map((obs) => ({
    dateLabel: formatShortDate(obs.record_date),
    fullDate: obs.record_date,
    liters: Number(obs.quantity_liters),
    isToday: false,
  }));

  // Append Today's entry
  const todayDateStr = submission.recordDate || "Today";
  chartData.push({
    dateLabel: "Ngayon (Today)",
    fullDate: todayDateStr,
    liters: Number(currentLiters),
    isToday: true,
    difference: diffLiters,
  });

  // Calculate clean Y-axis domain starting at 0
  const maxYield = Math.max(
    ...chartData.map((d) => d.liters),
    medianLiters ? medianLiters * 1.25 : 12,
  );
  const yAxisMax = Math.ceil(maxYield * 1.15);

  // Color config
  const todayBarColor = isSpike ? "#ea580c" : isDecline ? "#e11d48" : "#059669";
  const pastBarColor = "#94a3b8";
  const baselineLineColor = "#059669";

  return (
    <div
      className={`w-full rounded-2xl border p-4 sm:p-5 space-y-3.5 sm:space-y-4 transition-all shadow-xs ${
        submission.anomalyDetected
          ? "border-amber-300 bg-linear-to-b from-amber-50/70 via-white to-amber-50/30 text-amber-950"
          : isClean
          ? "border-emerald-200 bg-linear-to-b from-emerald-50/60 via-white to-emerald-50/20 text-emerald-950"
          : "border-slate-200 bg-slate-50/90 text-slate-800"
      }`}
    >
      {/* ─── 1. Friendly Header & Badge ─── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className={`size-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              submission.anomalyDetected
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : isClean
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-slate-100 text-slate-700 border border-slate-300"
            }`}
          >
            {submission.anomalyDetected ? (
              isSpike ? (
                <TrendingUp className="size-5" />
              ) : (
                <TrendingDown className="size-5" />
              )
            ) : isClean ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Milk className="size-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Pagsusuri sa Gatas (Milk Yield Check)
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              Gabay para sa CBAT field inspection at paghahambing sa karaniwang gatas ng baka
            </p>
          </div>
        </div>

        <div>
          {submission.anomalyDetected ? (
            <div className="flex flex-col sm:items-end gap-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide bg-amber-500 text-white shadow-2xs">
                {isSpike ? (
                  <>
                    <TrendingUp className="size-3.5 stroke-[3]" />
                    <span>Mataas ang Gatas (+{diffLiters ?? 0} {unitLabel})</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="size-3.5 stroke-[3]" />
                    <span>Mababang Gatas ({diffLiters ?? 0} {unitLabel})</span>
                  </>
                )}
              </span>
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                Kailangan beripikahin sa bukid
              </span>
            </div>
          ) : isClean ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <CheckCircle2 className="size-3.5" />
              Normal ang Gatas
            </span>
          ) : isInsufficient ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
              Bago ang Tala (Kaunti pa ang datos)
            </span>
          ) : null}
        </div>
      </div>

      {/* ─── 2. Plain Tagalog/English Farmer Summary ─── */}
      <div
        className={`p-3 sm:p-3.5 rounded-xl border text-xs sm:text-[13px] leading-relaxed ${
          submission.anomalyDetected
            ? "bg-amber-100/60 border-amber-300/80 text-amber-950"
            : isClean
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {submission.anomalyDetected ? (
          <p className="font-medium">
            <strong className="font-black text-amber-950">
              📌 Pansinin:
            </strong>{" "}
            Ang karaniwang bigay ng gatas ng bakang ito ay humigit-kumulang{" "}
            <strong className="font-bold underline decoration-amber-400">
              {medianLiters != null ? `${medianLiters} ${unitLabel}/araw` : "10 L/araw"}
            </strong>
            . Ngunit nagtala ang magsasaka ng{" "}
            <strong className="font-black text-amber-900">
              {currentLiters} {unitLabel}
            </strong>{" "}
            ngayong araw—
            {diffLiters != null && (
              <span>
                mas marami ng{" "}
                <strong className="font-bold text-amber-950">
                  +{diffLiters} {unitLabel} ({diffPct != null ? `+${diffPct}%` : ""})
                </strong>
                .{" "}
              </span>
            )}
            Bago ipadala sa MAO, mangyaring alamin sa bukid kung totoo o nagkamali lang sa pag-type.
          </p>
        ) : isClean ? (
          <p className="font-medium">
            <strong className="font-black text-emerald-950">
              ✅ Normal ang Rekord:
            </strong>{" "}
            Ang naitalang{" "}
            <strong>
              {currentLiters} {unitLabel}
            </strong>{" "}
            ay tugma sa karaniwang produksyon ng bakang ito (~
            {medianLiters} {unitLabel}/araw). Hindi na kailangan ng field check;
            didiretso ito sa MAO approval.
          </p>
        ) : (
          <p className="font-medium">
            Kaunti pa lamang ang naitalang araw para sa bakang ito. Patuloy na
            subaybayan ang susunod na mga tala upang makabuo ng sapat na
            kasaysayan.
          </p>
        )}
      </div>

      {/* ─── 3. Easy Comparison Cards (Big Numbers) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-xl bg-white/95 border border-slate-200/90 p-3 shadow-2xs">
          <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block">
            Karaniwan (Normal)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-xl font-black text-slate-900">
              {medianLiters != null ? `${medianLiters}` : "-"}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {unitLabel}/araw
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
            Batay sa {baseline?.window_days_used || 14} araw na tala
          </span>
        </div>

        <div
          className={`rounded-xl border p-3 shadow-2xs ${
            submission.anomalyDetected
              ? "bg-amber-500/10 border-amber-300"
              : "bg-white/95 border-slate-200/90"
          }`}
        >
          <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block">
            Naitala Ngayon (Today)
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-base sm:text-xl font-black ${
                submission.anomalyDetected ? "text-amber-900" : "text-slate-900"
              }`}
            >
              {currentLiters}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {unitLabel}
            </span>
          </div>
          <span
            className={`text-[10px] font-bold block truncate mt-0.5 ${
              submission.anomalyDetected ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {diffLiters != null
              ? `${diffLiters > 0 ? "+" : ""}${diffLiters} ${unitLabel} (${diffPct != null ? `${diffPct > 0 ? "+" : ""}${diffPct}%` : ""})`
              : "Sakto sa karaniwan"}
          </span>
        </div>

        {expectedLiters != null ? (
          <div className="rounded-xl bg-white/95 border border-slate-200/90 p-3 col-span-2 sm:col-span-1 shadow-2xs">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block">
              Inaasahang Tantya
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base sm:text-xl font-black text-slate-900">
                {expectedLiters}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {unitLabel}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
              7-araw na forecast estimate
            </span>
          </div>
        ) : (
          <div className="rounded-xl bg-white/95 border border-slate-200/90 p-3 col-span-2 sm:col-span-1 shadow-2xs">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide block">
              Status sa Field
            </span>
            <span className="text-sm sm:text-base font-black text-slate-800 block mt-1">
              {submission.anomalyDetected ? "Para sa CBAT" : "Handa sa MAO"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
              Review queue
            </span>
          </div>
        )}
      </div>

      {/* ─── 4. Wide Visual Comparison Chart ─── */}
      <div className="rounded-xl bg-white border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h5 className="text-xs sm:text-sm font-bold text-slate-900">
              Tsart ng Produksyon ng Gatas (Milk Yield Chart)
            </h5>
            <p className="text-[10.5px] sm:text-xs text-slate-500 font-medium">
              Paghahambing ng nakaraang mga araw laban sa naitala ngayong araw
            </p>
          </div>
          {medianLiters != null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 shadow-2xs">
              <span className="w-3 h-0.5 bg-emerald-600 inline-block rounded-full" />
              Karaniwang Antas: ~{medianLiters} {unitLabel}/araw
            </span>
          )}
        </div>

        {/* The Recharts Container (Wide & Spacious) */}
        <div className="h-52 sm:h-56 w-full min-w-0 pt-1">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 12, bottom: 4, left: -10 }}
                barCategoryGap="16%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  domain={[0, yAxisMax]}
                  unit={` ${unitLabel}`}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as ChartPoint;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur-xs p-2.5 text-xs shadow-lg space-y-1">
                        <p className="font-bold text-slate-900">
                          {item.fullDate} {item.isToday ? "(Naitala Ngayon)" : "(Aprubado)"}
                        </p>
                        <p className="text-slate-700">
                          Gatas: <strong className="text-slate-900">{item.liters} {unitLabel}</strong>
                        </p>
                        {medianLiters != null && (
                          <p className="text-[10.5px] text-slate-500 border-t border-slate-100 pt-1">
                            Karaniwan: {medianLiters} {unitLabel}/araw
                            {item.isToday && diffLiters != null && (
                              <span className="font-bold text-amber-700 block">
                                Pagkakaiba: {diffLiters > 0 ? "+" : ""}{diffLiters} {unitLabel} ({diffPct != null ? `${diffPct > 0 ? "+" : ""}${diffPct}%` : ""})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                {medianLiters != null && (
                  <ReferenceLine
                    y={medianLiters}
                    stroke={baselineLineColor}
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                )}
                <Bar
                  dataKey="liters"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={true}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isToday ? todayBarColor : pastBarColor}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full rounded-lg bg-slate-50 animate-pulse flex items-center justify-center text-xs text-slate-400">
              Ikinakarga ang tsart...
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-slate-600 pt-1.5 border-t border-slate-100">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="size-2.5 rounded-xs bg-[#94a3b8]" />
            Nakaraang mga araw
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-amber-900">
            <span
              className="size-2.5 rounded-xs"
              style={{ backgroundColor: todayBarColor }}
            />
            Naitala ngayong araw ({currentLiters} {unitLabel})
          </span>
          {medianLiters != null && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
              <span className="w-4 h-0.5 bg-emerald-600 inline-block" />
              Karaniwang antas (~{medianLiters} {unitLabel})
            </span>
          )}
        </div>
      </div>

      {/* ─── 5. CBAT Field Guide / Checklist (3 Columns on Wide Layout) ─── */}
      {submission.anomalyDetected && (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 p-3 sm:p-4 space-y-2.5 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-xs sm:text-sm">
            <ClipboardList className="size-4 text-amber-700" />
            <span>Ano ang itatanong o titingnan ng CBAT sa bukid?</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5 pt-0.5">
            <div className="rounded-xl bg-white/95 border border-amber-200/90 p-2.5 sm:p-3 shadow-2xs">
              <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5 mb-1">
                <span className="size-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                Maling pindot / typo?
              </span>
              <p className="text-[11px] sm:text-xs text-amber-950/80 leading-snug">
                Baka na-type ang <strong>{currentLiters} {unitLabel}</strong> sa halip na <strong>{medianLiters || 10} {unitLabel}</strong>?
              </p>
            </div>

            <div className="rounded-xl bg-white/95 border border-amber-200/90 p-2.5 sm:p-3 shadow-2xs">
              <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5 mb-1">
                <span className="size-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                Bagong anak o pakain?
              </span>
              <p className="text-[11px] sm:text-xs text-amber-950/80 leading-snug">
                Kamakailan ba nanganak (lactation peak), nagpalit ng mataas na protinang pakain, o 2x ginatasan?
              </p>
            </div>

            <div className="rounded-xl bg-white/95 border border-amber-200/90 p-2.5 sm:p-3 shadow-2xs">
              <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5 mb-1">
                <span className="size-4 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                Pinagsamang gatas?
              </span>
              <p className="text-[11px] sm:text-xs text-amber-950/80 leading-snug">
                Baka napagsama ang gatas ng 2 o higit pang baka sa iisang talaan ng magsasaka?
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-amber-950">
              👉 <strong>Kung TAMA at totoo ang {currentLiters} {unitLabel}:</strong> I-click ang <strong>&quot;Verify &amp; Forward to MAO&quot;</strong> sa ibaba.
            </span>
            <span className="text-amber-950">
              👉 <strong>Kung NAGKAMALI ang magsasaka:</strong> I-click ang <strong>&quot;Return for Revision&quot;</strong> upang maiwasto.
            </span>
          </div>
        </div>
      )}

      {/* ─── 6. Collapsible Technical Baseline Details ─── */}
      <div className="border-t border-slate-200/80 pt-1.5">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-500 hover:text-slate-800 py-1 cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="size-3.5" />
            Teknikal na Detalye at Formulas (Statistical Audit)
          </span>
          {showTechnicalDetails ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 font-mono">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block font-sans uppercase text-[10px]">
                  Rolling Median:
                </span>
                <span className="font-bold text-slate-900">
                  {medianLiters ?? "N/A"} {unitLabel}/day
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans uppercase text-[10px]">
                  Rolling Mean:
                </span>
                <span className="font-bold text-slate-900">
                  {meanLiters ?? "N/A"} {unitLabel}/day
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans uppercase text-[10px]">
                  Window Used:
                </span>
                <span className="font-bold text-slate-900">
                  {baseline?.window_days_used ?? "N/A"} days
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans uppercase text-[10px]">
                  Deviation:
                </span>
                <span className="font-bold text-slate-900">
                  {diffLiters != null ? `${diffLiters > 0 ? "+" : ""}${diffLiters} ${unitLabel}` : "N/A"} (
                  {diffPct != null ? `${diffPct > 0 ? "+" : ""}${diffPct}%` : "N/A"})
                </span>
              </div>
            </div>

            {forecast && (
              <div className="pt-1.5 border-t border-slate-200 text-[11px]">
                <span className="text-slate-400 block font-sans uppercase text-[10px]">
                  7-Day Forecast Context:
                </span>
                {forecast.available && forecast.status === "MATCHED" ? (
                  <span>
                    Forecast: <strong>{forecast.expected_liters} {unitLabel}</strong> (diff:{" "}
                    {forecast.deviation_liters} {unitLabel} / {forecast.deviation_pct}%)
                  </span>
                ) : (
                  <span className="italic text-slate-500">
                    {forecast.reason || "No matched date-aligned forecast."}
                  </span>
                )}
              </div>
            )}

            <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-500 font-sans">
              <strong>System Assessment Reason:</strong>{" "}
              {submission.anomalyReason || assessment.reason || "No additional note."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
