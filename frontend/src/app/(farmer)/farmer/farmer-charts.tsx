"use client";

import { useRouter } from "next/navigation";
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
import { Milk, Plus, Package } from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm rounded-3xl p-5 space-y-3">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-[280px] w-full rounded-2xl" />
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-3xl p-5 space-y-3">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-[280px] w-full rounded-2xl" />
        </Card>
      </div>
    );
  }

  const categories = data?.herd_categories ?? [];
  const subcategories = data?.herd_subcategories ?? [];
  const milkTrend = data?.milk_trend ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. HERD COMPOSITION (PIE CHART) */}
      <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl flex flex-col justify-between overflow-hidden">
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
                Species & Breed distribution on your farm
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
          {categories.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 my-2">
              <div className="p-3 bg-white rounded-2xl shadow-2xs border border-emerald-900/10 mb-2.5">
                <Icon iconNode={cowHead} className="size-6 text-emerald-800" />
              </div>
              <p className="text-xs font-bold text-slate-700">No livestock recorded yet</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                Add your cattle, carabaos, goats, or swine to visualize your herd breakdown.
              </p>
              <Button
                size="sm"
                onClick={() => router.push("/livestock-inventory")}
                className="mt-3 bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs rounded-xl font-bold gap-1"
              >
                <Plus className="size-3.5" /> Register Animal
              </Button>
            </div>
          ) : (
            <>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%" debounce={150}>
                  <PieChart margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                    <Pie
                      data={categories}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      stroke="#ffffff"
                      strokeWidth={2}
                      paddingAngle={3}
                    >
                      {categories.map((entry, i) => (
                        <Cell key={`cat-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} heads`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-slate-100">
                {categories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-semibold">{cat.name}</span>
                    <span className="text-slate-400">({cat.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. MILK / DAIRY PRODUCTION (BAR CHART) */}
      <Card className="border-2 border-sky-900/10 bg-white shadow-xs rounded-3xl flex flex-col justify-between overflow-hidden">
        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
              <Milk className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Monthly Dairy Yield Output
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Recorded milk production in Liters
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
          {milkTrend.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 my-2">
              <div className="p-3 bg-white rounded-2xl shadow-2xs border border-sky-900/10 mb-2.5">
                <Milk className="size-6 text-sky-800" />
              </div>
              <p className="text-xs font-bold text-slate-700">No production logs recorded</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                Start logging your daily or monthly milk yields to track dairy output trends.
              </p>
              <Button
                size="sm"
                onClick={() => router.push("/production-dashboard")}
                className="mt-3 bg-sky-700 hover:bg-sky-800 text-white text-xs rounded-xl font-bold gap-1"
              >
                <Package className="size-3.5" /> Log Yield
              </Button>
            </div>
          ) : (
            <div className="h-[260px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%" debounce={150}>
                <BarChart data={milkTrend} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={formatPeriodMonth}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}L`}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${formatQty(Number(value))} Liters`, "Milk Yield"]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Bar dataKey="quantity" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
