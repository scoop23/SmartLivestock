"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Egg,
  Milk,
  Package,
  PhilippinePeso,
  Beef,
  TrendingUp,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatPeso,
  formatPesoCompact,
  formatPeriodMonth,
  PRODUCTION_TYPE_LABELS,
  type ProductionType,
  type ProductionTypeAnalytics,
} from "./production-analytics";

const TYPE_CHART: Record<
  ProductionType,
  { label: string; color: string; activeColor: string; unit: string }
> = {
  milk: { label: "Liters", color: "#0284c7", activeColor: "#0369a1", unit: "L" },
  meat: { label: "Kilograms", color: "#dc2626", activeColor: "#b91c1c", unit: "kg" },
  eggs: { label: "Pieces", color: "#d97706", activeColor: "#b45309", unit: "pcs" },
  wool: { label: "Kilograms", color: "#57534e", activeColor: "#44403c", unit: "kg" },
};

const TYPE_ICONS: Record<ProductionType, typeof Milk> = {
  milk: Milk,
  meat: Beef,
  eggs: Egg,
  wool: Package,
};

const chartConfig = {
  quantity: { label: "Output Volume", color: "#0284c7" },
  value: { label: "Estimated Production Value", color: "#059669" },
} satisfies ChartConfig;

function ChartEmpty({ label, description = "Recorded production will appear here to illustrate historical trends." }: { label: string; description?: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <LineChartIcon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="text-xs text-slate-400 max-w-xs">
        {description}
      </p>
    </div>
  );
}

export default function ProductionCharts({
  type,
  data,
}: {
  type: ProductionType;
  data: ProductionTypeAnalytics;
}) {
  const [activeView, setActiveView] = useState<"volume" | "value">("volume");

  const label = PRODUCTION_TYPE_LABELS[type] ?? "Dairy Milk";
  const trend = data.trend ?? [];
  const valueTrend = data.value_trend ?? [];
  const Icon = TYPE_ICONS[type] ?? Milk;
  const unitInfo = TYPE_CHART[type] ?? TYPE_CHART.milk;

  // Merge trend & value data by period with verified vs pending separation
  const mergedData = trend.map((t) => {
    const valObj = valueTrend.find((v) => v.period === t.period);
    return {
      period: t.period,
      quantity: t.quantity,
      verifiedQuantity: t.verifiedQuantity ?? 0,
      pendingQuantity: t.pendingQuantity ?? 0,
      revisionQuantity: t.revisionQuantity ?? 0,
      value: valObj ? valObj.value : null,
      verifiedValue: valObj ? valObj.verifiedValue : null,
      pendingValue: valObj ? valObj.pendingValue : null,
    };
  });

  // Only show Estimated Value where a compatible price exists (e.g. cattle milk)
  const hasValuation = Boolean(
    (data.summary?.reference_prices && data.summary.reference_prices.length > 0) ||
    valueTrend.length > 0
  );
  const currentView = hasValuation ? activeView : "volume";

  // Dynamic chart config based on current production type color
  const dynamicChartConfig = {
    quantity: { label: "Total Recorded Volume", color: unitInfo.color },
    verifiedQuantity: { label: "Verified Yield", color: unitInfo.color },
    pendingQuantity: { label: "Awaiting Verification", color: "#f59e0b" },
    revisionQuantity: { label: "Needs Revision", color: "#ef4444" },
    value: { label: "Estimated Reference Value", color: "#059669" },
    verifiedValue: { label: "Verified Value", color: "#059669" },
    pendingValue: { label: "Awaiting Verification Value", color: "#f59e0b" },
  } satisfies ChartConfig;

  // Calculate quick stats
  const totalVolume = trend.reduce((sum, item) => sum + item.quantity, 0);
  const totalVerifiedVolume = trend.reduce((sum, item) => sum + (item.verifiedQuantity ?? 0), 0);
  const totalPendingVolume = trend.reduce((sum, item) => sum + (item.pendingQuantity ?? 0), 0);
  const totalRevisionVolume = trend.reduce((sum, item) => sum + (item.revisionQuantity ?? 0), 0);
  const peakMonth = [...trend].sort((a, b) => b.quantity - a.quantity)[0];
  const avgMonthlyVolume =
    trend.length > 0 ? (totalVolume / trend.length).toFixed(1) : "0";

  // Chart colors: Point A (verified), Point B (awaiting), blend (both combined)
  const pointAColor = type === "meat" ? "#dc2626" : "#0284c7";
  const pointBColor = "#eab308";
  const combiningColor = type === "meat" ? "#f97316" : "#06b6d4";
  const hasPending = totalPendingVolume > 0;

  // Value view statistics
  const totalEstimatedValue = valueTrend.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const totalVerifiedValue = valueTrend.reduce((sum, item) => sum + (item.verifiedValue ?? 0), 0);
  const totalPendingValue = valueTrend.reduce((sum, item) => sum + (item.pendingValue ?? 0), 0);
  const peakValueMonth = [...valueTrend].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const avgMonthlyValue =
    valueTrend.length > 0 ? Math.round(totalEstimatedValue / valueTrend.length) : 0;

  return (
    <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
      <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                type === "milk"
                  ? "bg-sky-100 text-sky-700"
                  : type === "meat"
                  ? "bg-rose-100 text-rose-700"
                  : type === "eggs"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-stone-200 text-stone-700"
              }`}
            >
              <Icon className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                My Recorded {label} Production
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                {currentView === "volume"
                  ? "Your reported production output. Verified records have completed official SIBAT/MAO review."
                  : "Estimated benchmark value based on official PSA rates. Awaiting verification values are indicative."}
              </CardDescription>
            </div>
          </div>

          {/* View Toggle: Only show when a compatible valuation exists */}
          {hasValuation && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveView("volume")}
                aria-pressed={currentView === "volume"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentView === "volume"
                    ? "bg-white text-sky-800 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                <LineChartIcon className="size-3.5" />
                Yield Volume ({unitInfo.unit})
              </button>
              <button
                type="button"
                onClick={() => setActiveView("value")}
                aria-pressed={currentView === "value"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentView === "value"
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                <PhilippinePeso className="size-3.5" />
                Estimated Value (PHP)
              </button>
            </div>
          )}
        </div>

        {/* Quick Statistical Highlight Ribbon */}
        {trend.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mt-2 border-t border-slate-100 text-xs">
            {currentView === "volume" ? (
              <>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase block">
                    My Recorded Output
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {totalVolume.toLocaleString()} {unitInfo.unit}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                    {hasPending
                      ? `${totalVerifiedVolume.toLocaleString()} ${unitInfo.unit} verified · ${totalPendingVolume.toLocaleString()} ${unitInfo.unit} awaiting`
                      : `${totalVerifiedVolume.toLocaleString()} ${unitInfo.unit} verified`}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase block">
                    Average per Recorded Month
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {Number(avgMonthlyVolume).toLocaleString()} {unitInfo.unit} / mo
                  </span>
                  {totalRevisionVolume > 0 && (
                    <span className="text-[10px] text-rose-600 font-medium block mt-0.5">
                      {totalRevisionVolume.toLocaleString()} {unitInfo.unit} needs revision
                    </span>
                  )}
                </div>
                {peakMonth && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase block">
                      Peak Month Record
                    </span>
                    <span
                      className="font-bold text-sm mt-0.5 block"
                      style={{ color: unitInfo.color }}
                    >
                      {peakMonth.quantity.toLocaleString()} {unitInfo.unit} ({formatPeriodMonth(peakMonth.period)})
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block">
                    Total Estimated Value
                  </span>
                  <span className="font-black text-emerald-950 text-sm mt-0.5 block">
                    {formatPesoCompact(totalEstimatedValue)}
                  </span>
                  <span className="text-[10px] text-emerald-800 font-medium block mt-0.5">
                    {totalPendingValue > 0
                      ? `${formatPesoCompact(totalVerifiedValue)} verified · ${formatPesoCompact(totalPendingValue)} indicative`
                      : `${formatPesoCompact(totalVerifiedValue)} verified`}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block">
                    Avg Monthly Value
                  </span>
                  <span className="font-black text-emerald-950 text-sm mt-0.5 block">
                    {formatPesoCompact(avgMonthlyValue)} / mo
                  </span>
                </div>
                {peakValueMonth && (
                  <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 col-span-2 sm:col-span-1">
                    <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block">
                      Peak Value Month
                    </span>
                    <span className="font-black text-emerald-900 text-sm mt-0.5 block">
                      {formatPesoCompact(peakValueMonth.value ?? 0)} ({formatPeriodMonth(peakValueMonth.period)})
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5 sm:p-6 pt-4">
        {currentView === "value" && hasValuation && (
          <div className="mb-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-teal-50/40 p-3 sm:p-3.5 text-xs shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-emerald-950 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                  <PhilippinePeso className="size-3.5 text-emerald-700" />
                  PSA Farmgate Rate:
                </span>
                {data.summary.reference_prices && data.summary.reference_prices.length > 0 ? (
                  data.summary.reference_prices.map((reference, index) => (
                    <span
                      key={`${reference.commodity_id}-${index}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/90 px-2.5 py-0.5 text-xs font-black text-emerald-950 border border-emerald-200/80"
                      title={`${reference.commodity} (${reference.reference_period} · ${reference.geography})`}
                    >
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                        maximumFractionDigits: 2,
                      }).format(Number(reference.price))}
                      <span className="font-semibold text-emerald-800 text-[10px]">
                        /{reference.unit === "LITERS" ? "L" : reference.unit === "KILOGRAMS" ? "kg" : reference.unit === "PIECES" ? "pc" : reference.unit.toLowerCase()}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 italic text-[11px]">No price on file</span>
                )}
                {data.summary.reference_periods && data.summary.reference_periods.length > 0 && (
                  <span className="text-[10px] font-medium text-emerald-800/80 bg-white/70 px-2 py-0.5 rounded border border-emerald-100">
                    Ref: {data.summary.reference_periods.join(", ")}
                  </span>
                )}
              </div>

              {data.summary.reference_prices?.[0]?.source_url && (
                <a
                  href={data.summary.reference_prices[0].source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-emerald-700 hover:text-emerald-950 underline underline-offset-2 shrink-0 self-start sm:self-auto"
                >
                  Official PSA Source ↗
                </a>
              )}
            </div>

            {/* Farmer-friendly note */}
            <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-start gap-1.5 text-[11px] text-emerald-900 leading-snug">
              <span className="text-sm shrink-0">🌾</span>
              <p>
                <strong className="font-semibold text-emerald-950">Farmer Note:</strong>{" "}
                Estimated value is based on official PSA benchmark farmgate rates to help track your harvest worth. This is a reference guide, not your actual cash sales.
                {!!data.summary.fallback_record_count && " (Some months use the latest earlier available PSA period)"}
              </p>
            </div>
          </div>
        )}

        {/* Farmer Status Guidance & Legend */}
        {mergedData.length > 0 && currentView === "volume" && (
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: pointAColor }}
                />
                <span>Verified ({type === "meat" ? "Red" : "Blue"})</span>
              </span>
              {hasPending && (
                <>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-600 text-[11px]">
                    <span
                      className="h-2 w-7 rounded-full shadow-2xs inline-block"
                      style={{
                        background: `linear-gradient(to right, ${pointAColor}, ${combiningColor}, ${pointBColor})`,
                      }}
                    />
                    <span>Combining in middle</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-amber-800">
                    <span className="size-2.5 rounded-full bg-yellow-400 border border-yellow-500" />
                    <span>Awaiting Review (Yellow)</span>
                  </span>
                </>
              )}
              {totalRevisionVolume > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-rose-800">
                  <span className="size-2.5 rounded-full bg-rose-400 border border-rose-500" />
                  <span>⚠ Needs Revision</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 italic">
              {hasPending
                ? "Your chart shows all your submitted records with verified records distinguished from pending reviews."
                : "Your chart shows all your submitted records, all of which have completed official verification."}
            </p>
          </div>
        )}

        {mergedData.length === 0 ? (
          <ChartEmpty label={`No ${label.toLowerCase()} records logged yet`} />
        ) : currentView === "volume" ? (
          <ChartContainer config={dynamicChartConfig} className="aspect-auto h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={mergedData}
                margin={{ top: 12, right: 12, bottom: 0, left: -10 }}
              >
                <defs>
                  {/* Point A (Blue or Red if meat) -> Middle (combining blend) -> Point B (Yellow) */}
                  <linearGradient
                    id={`strokeGradient-${type}-${hasPending ? "blend" : "solid"}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={pointAColor} />
                    {hasPending && <stop offset="50%" stopColor={combiningColor} />}
                    <stop offset="100%" stopColor={hasPending ? pointBColor : pointAColor} />
                  </linearGradient>
                  <linearGradient
                    id={`areaCombinedGradient-${type}-${hasPending ? "blend" : "solid"}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={pointAColor} stopOpacity={0.4} />
                    {hasPending && (
                      <stop offset="50%" stopColor={combiningColor} stopOpacity={0.28} />
                    )}
                    <stop
                      offset="100%"
                      stopColor={hasPending ? pointBColor : pointAColor}
                      stopOpacity={hasPending ? 0.35 : 0.4}
                    />
                  </linearGradient>
                  <linearGradient id="revisionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  tickFormatter={formatPeriodMonth}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  tickFormatter={(value: number) => `${value}${unitInfo.unit}`}
                />
                <ChartTooltip
                  cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }}
                  content={({ active, payload, label: tooltipLabel }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload;
                    if (!item) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1.5 min-w-[200px]">
                        <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">
                          {formatPeriodMonth(String(tooltipLabel))}
                        </p>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-semibold">Total Recorded:</span>
                          <span className="font-black text-slate-900">
                            {Number(item.quantity).toLocaleString()} {unitInfo.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between" style={{ color: pointAColor }}>
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="size-2 rounded-full" style={{ backgroundColor: pointAColor }} />
                            Verified:
                          </span>
                          <span className="font-bold">
                            {Number(item.verifiedQuantity || 0).toLocaleString()} {unitInfo.unit}
                          </span>
                        </div>
                        {hasPending && (
                          <div className="flex items-center justify-between text-amber-700">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="size-2 rounded-full bg-yellow-500" />
                              Awaiting Review:
                            </span>
                            <span className="font-bold">
                              {Number(item.pendingQuantity || 0).toLocaleString()} {unitInfo.unit}
                            </span>
                          </div>
                        )}
                        {Number(item.revisionQuantity || 0) > 0 && (
                          <div className="flex items-center justify-between text-rose-800">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="size-2 rounded-full bg-rose-500" />
                              Needs Revision:
                            </span>
                            <span className="font-bold">
                              {Number(item.revisionQuantity).toLocaleString()} {unitInfo.unit}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="quantity"
                  name="Recorded Output"
                  stroke={`url(#strokeGradient-${type}-${hasPending ? "blend" : "solid"})`}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill={`url(#areaCombinedGradient-${type}-${hasPending ? "blend" : "solid"})`}
                  dot={(dotProps: any) => {
                    const { cx, cy, payload, index } = dotProps;
                    if (cx == null || cy == null || !payload) return null;

                    const hasVerified = (payload.verifiedQuantity ?? 0) > 0;
                    const hasPendingPoint = (payload.pendingQuantity ?? 0) > 0;

                    let dotFill = pointAColor;
                    let isCombined = false;

                    if (!hasPending) {
                      dotFill = pointAColor;
                    } else if (hasVerified && hasPendingPoint) {
                      dotFill = combiningColor;
                      isCombined = true;
                    } else if (hasPendingPoint && !hasVerified) {
                      dotFill = pointBColor;
                    } else if (hasVerified && !hasPendingPoint) {
                      dotFill = pointAColor;
                    } else {
                      const totalPoints = mergedData.length;
                      if (totalPoints > 1) {
                        const ratio = index / (totalPoints - 1);
                        if (ratio < 0.33) dotFill = pointAColor;
                        else if (ratio > 0.66) dotFill = pointBColor;
                        else {
                          dotFill = combiningColor;
                          isCombined = true;
                        }
                      }
                    }

                    return (
                      <g key={`custom-dot-${index}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isCombined ? 5.5 : 4.5}
                          fill={dotFill}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                        {isCombined && <circle cx={cx} cy={cy} r={2} fill="#ffffff" />}
                      </g>
                    );
                  }}
                  activeDot={{
                    r: 7,
                    strokeWidth: 2,
                    stroke: "#ffffff",
                    fill: hasPending ? combiningColor : pointAColor,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <ChartContainer config={dynamicChartConfig} className="aspect-auto h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mergedData}
                margin={{ top: 12, right: 12, bottom: 0, left: -6 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  tickFormatter={formatPeriodMonth}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  tickFormatter={(value: number) => formatPesoCompact(value)}
                />
                <ChartTooltip
                  cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                  content={({ active, payload, label: tooltipLabel }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload;
                    if (!item) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1.5 min-w-[200px]">
                        <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">
                          {formatPeriodMonth(String(tooltipLabel))}
                        </p>
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-semibold">Total Reference Value:</span>
                          <span className="font-black text-slate-900">{formatPeso(Number(item.value || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-800">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="size-2 rounded-full bg-emerald-600" />
                            Verified Value:
                          </span>
                          <span className="font-bold">{formatPeso(Number(item.verifiedValue || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-800">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="size-2 rounded-full bg-amber-500" />
                            Indicative (Awaiting):
                          </span>
                          <span className="font-bold">{formatPeso(Number(item.pendingValue || 0))}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="verifiedValue"
                  name="Verified Value"
                  stackId="val"
                  fill="#059669"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={44}
                />
                <Bar
                  dataKey="pendingValue"
                  name="Awaiting Verification (Indicative)"
                  stackId="val"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

