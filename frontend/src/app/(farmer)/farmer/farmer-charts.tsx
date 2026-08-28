"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPeriodMonth,
  formatQty,
  type FarmerDashboardAnalytics,
} from "./farmer-analytics";

export default function FarmerCharts({
  data,
  isLoading = false,
}: {
  data?: FarmerDashboardAnalytics;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm rounded-2xl p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-2xl p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </Card>
      </div>
    );
  }

  const categories = data?.herd_categories ?? [];
  const subcategories = data?.herd_subcategories ?? [];
  const milkTrend = data?.milk_trend ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. HERD COMPOSITION (TWO-LEVEL PIE CHART) */}
      <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-2xl flex flex-col justify-between">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Icon iconNode={cowHead} className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Herd Composition Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Inner: Species • Outer: Subtypes & Purpose
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: -50, right: 12, bottom: 12, left: 12 }}>
                {/* Inner Level: Primary Species */}
                <Pie
                  data={categories}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {categories.map((entry, i) => (
                    <Cell key={`cat-${i}`} fill={entry.color} />
                  ))}
                </Pie>

                {/* Outer Level: Subtypes */}
                <Pie
                  data={subcategories}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={98}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {subcategories.map((entry, i) => (
                    <Cell key={`sub-${i}`} fill={entry.color} />
                  ))}
                </Pie>

                <Tooltip formatter={(value, name) => [`${value} heads`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Simple Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-slate-100">
            {categories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="font-semibold">{cat.name}</span>
                <span className="text-slate-400">({cat.value})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. MILK PRODUCTION (BAR CHART) */}
      <Card className="border-2 border-amber-900/10 bg-white shadow-xs rounded-2xl flex flex-col justify-between">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Milk className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Milk Production (Liters)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Monthly approved output
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0">
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={milkTrend} margin={{ top: 20, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
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
                  tickFormatter={(val: number) => `${val}L`}
                />
                <Tooltip formatter={(value) => [`${formatQty(Number(value))} Liters`, "Output"]} />
                <Bar
                  dataKey="quantity"
                  fill="#0284c7"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-center pt-3 border-t border-slate-100 text-xs text-slate-500">
            Current Month: <strong className="text-slate-800">{formatQty(data?.milk_production_liters ?? 0)} L</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
