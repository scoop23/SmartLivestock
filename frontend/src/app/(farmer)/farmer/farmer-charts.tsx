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
import { Milk } from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPeriodMonth,
  type FarmerDashboardAnalytics,
} from "./farmer-analytics";

const cattleChartConfig = {
  quantity: { label: "Heads", color: "#059669" },
} satisfies ChartConfig;

const milkChartConfig = {
  quantity: { label: "Liters", color: "#0ea5e9" },
} satisfies ChartConfig;

function ChartEmpty({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-6 text-center">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
  );
}

export default function FarmerCharts({
  data,
  isLoading = false,
}: {
  data?: FarmerDashboardAnalytics;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const cattleTrend = data?.cattle_trend ?? [];
  const milkTrend = data?.milk_trend ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1 — Cattle Inventory Trend */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100/80">
              <Icon iconNode={cowHead} className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Cattle Inventory Trend
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Herd size over time
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {cattleTrend.length === 0 ? (
            <ChartEmpty
              label="Not enough historical data"
              hint="Inventory history isn't tracked yet. Historical snapshots are required."
            />
          ) : (
            <ChartContainer config={cattleChartConfig} className="aspect-auto h-[260px] w-full">
              <LineChart data={cattleTrend} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
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
                  tickFormatter={(value: number) => `${value}`}
                />
                <ChartTooltip
                  cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => formatPeriodMonth(String(label))}
                      formatter={(value) => `${Number(value)} heads`}
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

      {/* Chart 2 — Milk Production Trend */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-100/80">
              <Milk className="w-4 h-4 text-sky-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Milk Production (Liters)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Approved milk output per month
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {milkTrend.length === 0 ? (
            <ChartEmpty
              label="Not enough production history"
              hint="Approved milk records will appear here."
            />
          ) : (
            <ChartContainer config={milkChartConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={milkTrend} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
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
                  tickFormatter={(value: number) => `${value}L`}
                />
                <ChartTooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => formatPeriodMonth(String(label))}
                      formatter={(value) => `${Number(value).toLocaleString()} L`}
                    />
                  }
                />
                <Bar
                  dataKey="quantity"
                  fill="var(--color-quantity)"
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
