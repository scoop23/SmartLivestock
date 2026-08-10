"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Egg, Milk, Package, PhilippinePeso } from "lucide-react";
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

const TYPE_CHART: Record<ProductionType, { label: string; color: string }> = {
  milk: { label: "Liters", color: "#0284c7" },
  eggs: { label: "Pieces", color: "#d97706" },
  wool: { label: "Kilograms", color: "#57534e" },
};

const TYPE_ICONS: Record<ProductionType, typeof Milk> = {
  milk: Milk,
  eggs: Egg,
  wool: Package,
};

const valueChartConfig = {
  value: { label: "Estimated value", color: "#059669" },
} satisfies ChartConfig;

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-6 text-center">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-xs text-slate-400">
        Approved production records will appear here.
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
  const label = PRODUCTION_TYPE_LABELS[type];
  const trend = data.trend ?? [];
  const valueTrend = data.value_trend ?? [];
  const Icon = TYPE_ICONS[type];

  const trendChartConfig = {
    quantity: { label: TYPE_CHART[type].label, color: TYPE_CHART[type].color },
  } satisfies ChartConfig;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1 — {type} Production Trend */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${type === "milk" ? "bg-sky-100/80" : type === "eggs" ? "bg-amber-100/80" : "bg-stone-200/80"}`}>
              <Icon className={`w-4 h-4 ${type === "milk" ? "text-sky-700" : type === "eggs" ? "text-amber-800" : "text-stone-700"}`} />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                {label} Production Trend
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Production output over time
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {trend.length === 0 ? (
            <ChartEmpty label={`No ${label.toLowerCase()} production data yet`} />
          ) : (
            <ChartContainer config={trendChartConfig} className="aspect-auto h-[260px] w-full">
              <LineChart data={trend} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={formatPeriodMonth}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: number) => `${value}${type === "milk" ? "L" : type === "eggs" ? "pc" : "kg"}`}
                />
                <ChartTooltip
                  cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(labelValue) => formatPeriodMonth(String(labelValue))}
                      formatter={(value) => `${Number(value).toLocaleString()} ${TYPE_CHART[type].label}`}
                    />
                  }
                />
                <Line
                  dataKey="quantity"
                  type="natural"
                  stroke="var(--color-quantity)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Chart 2 — Estimated Production Value */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100/80">
              <PhilippinePeso className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Estimated Production Value
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Estimated value of {label.toLowerCase()} over time
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {valueTrend.length === 0 ? (
            <ChartEmpty label={`No estimated value data yet for ${label.toLowerCase()}`} />
          ) : (
            <ChartContainer config={valueChartConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={valueTrend} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={formatPeriodMonth}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: number) => formatPesoCompact(value)}
                />
                <ChartTooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(labelValue) => formatPeriodMonth(String(labelValue))}
                      formatter={(value) => formatPeso(Number(value))}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-value)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
