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
  value: { label: "Gross Market Value", color: "#059669" },
} satisfies ChartConfig;

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <LineChartIcon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="text-xs text-slate-400 max-w-xs">
        Approved production records will appear here to illustrate historical trends.
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
      value: valObj ? valObj.value : t.quantity * 50,
    };
  });

  // Calculate quick stats
  const totalVolume = trend.reduce((sum, item) => sum + item.quantity, 0);
  const peakMonth = [...trend].sort((a, b) => b.quantity - a.quantity)[0];
  const avgMonthlyVolume =
    trend.length > 0 ? (totalVolume / trend.length).toFixed(1) : "0";

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
                {label} Production Trends & Economic Analytics
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Historical monthly yields and estimated gross value generated
              </CardDescription>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveView("volume")}
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === "value"
                  ? "bg-white text-emerald-800 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
            >
              <PhilippinePeso className="size-3.5" />
              Gross Value (₱)
            </button>
          </div>
        </div>

        {/* Quick Statistical Highlight Ribbon */}
        {trend.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 mt-2 border-t border-slate-100 text-xs">
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
                Average Monthly Yield
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
                <span className="font-bold text-emerald-800 text-sm mt-0.5 block">
                  {peakMonth.quantity.toLocaleString()} {unitInfo.unit} ({formatPeriodMonth(peakMonth.period)})
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5 sm:p-6 pt-4">
        {mergedData.length === 0 ? (
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

