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

const TYPE_CHART: Record<ProductionType, { label: string; color: string; unit: string }> = {
  milk: { label: "Liters", color: "#0284c7", unit: "L" },
  meat: { label: "Kilograms", color: "#e11d48", unit: "kg" },
  eggs: { label: "Pieces", color: "#d97706", unit: "pcs" },
  wool: { label: "Kilograms", color: "#57534e", unit: "kg" },
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

  // Merge trend & value data by period
  const mergedData = trend.map((t) => {
    const valObj = valueTrend.find((v) => v.period === t.period);
    return {
      period: t.period,
      quantity: t.quantity,
      value: valObj ? valObj.value : null,
    };
  });

  // Calculate quick stats
  const totalVolume = trend.reduce((sum, item) => sum + item.quantity, 0);
  const peakMonth = [...trend].sort((a, b) => b.quantity - a.quantity)[0];
  const avgMonthlyVolume =
    trend.length > 0 ? (totalVolume / trend.length).toFixed(1) : "0";

  // Value view statistics
  const totalEstimatedValue = valueTrend.reduce((sum, item) => sum + (item.value ?? 0), 0);
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
                Recorded {label} Production
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                {activeView === "volume"
                  ? "Reported production volume trends across review statuses."
                  : "Estimated production value based on official PSA benchmark farmgate rates."}
              </CardDescription>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveView("volume")}
              aria-pressed={activeView === "volume"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === "volume"
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
              aria-pressed={activeView === "value"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === "value"
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
            >
              <PhilippinePeso className="size-3.5" />
              Estimated Value (PHP)
            </button>
          </div>
        </div>

        {/* Quick Statistical Highlight Ribbon */}
        {trend.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mt-2 border-t border-slate-100 text-xs">
            {activeView === "volume" ? (
              <>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase block">
                    Total Output Recorded
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {totalVolume.toLocaleString()} {unitInfo.unit}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase block">
                    Average per Recorded Month
                  </span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {Number(avgMonthlyVolume).toLocaleString()} {unitInfo.unit} / mo
                  </span>
                </div>
                {peakMonth && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase block">
                      Peak Month Record
                    </span>
                    <span className="font-bold text-sky-800 text-sm mt-0.5 block">
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
        {activeView === "value" && (
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

        {activeView === "value" && valueTrend.length === 0 ? (
          <ChartEmpty
            label="Estimated Value Guide Unavailable"
            description="Official PSA benchmark farmgate prices are not yet on file for this period. Your production quantity logs are safely recorded and verified."
          />
        ) : mergedData.length === 0 ? (
          <ChartEmpty label={`No ${label.toLowerCase()} records logged yet`} />
        ) : activeView === "volume" ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={mergedData}
                margin={{ top: 12, right: 12, bottom: 0, left: -10 }}
              >
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
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
                  content={
                    <ChartTooltipContent
                      labelFormatter={(labelValue) => formatPeriodMonth(String(labelValue))}
                      formatter={(value) => `${Number(value).toLocaleString()} ${unitInfo.label}`}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="quantity"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#volumeGradient)"
                  dot={{ r: 4, fill: "#0284c7", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 6, fill: "#0369a1" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
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
                  content={
                    <ChartTooltipContent
                      labelFormatter={(labelValue) => formatPeriodMonth(String(labelValue))}
                      formatter={(value) => formatPeso(Number(value))}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  fill="#059669"
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

