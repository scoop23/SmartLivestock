"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
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
  Legend,
} from "recharts";
import {
  Milk,
  Plus,
  Package,
  ShieldCheck,
  Stethoscope,
  Skull,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-slate-200 shadow-xs rounded-3xl p-5 space-y-3 bg-white">
            <Skeleton className="h-5 w-48 rounded-lg" />
            <Skeleton className="h-[220px] w-full rounded-2xl" />
          </Card>
        ))}
      </div>
    );
  }

  const categories = data?.herd_categories ?? [];
  const milkTrend = data?.milk_trend ?? [];
  const statusBreakdown = data?.status_breakdown ?? [];
  const healthTrend = data?.health_incident_trend ?? [];

  const totalHerdCount = data?.cattle_count ?? 0;
  const approvedCount = data?.approved_count ?? 0;
  const complianceRate =
    totalHerdCount > 0 ? Math.round((approvedCount / totalHerdCount) * 100) : 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="size-4.5 text-[#2D5A27]" />
            Farm Operational & Biological Intelligence
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time telemetry across herd demographics, monthly dairy yields, inspection compliance, and health surveillance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── 1. HERD SPECIES COMPOSITION (DONUT CHART) ── */}
        <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl flex flex-col justify-between overflow-hidden hover:border-emerald-700/30 transition-all">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Icon iconNode={cowHead} className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Herd Composition Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Live registered species in Padre Garcia registry
                  </CardDescription>
                </div>
              </div>

              <Badge variant="outline" className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border-emerald-200">
                {totalHerdCount} Total Heads
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
            {categories.length === 0 ? (
              <div className="h-[230px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 my-2">
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
                  className="mt-3 bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs rounded-xl font-bold gap-1 cursor-pointer"
                >
                  <Plus className="size-3.5" /> Register Animal
                </Button>
              </div>
            ) : (
              <>
                <div className="h-[200px] w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={78}
                        stroke="#ffffff"
                        strokeWidth={2}
                        paddingAngle={3}
                      >
                        {categories.map((entry, i) => (
                          <Cell key={`cat-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                        formatter={(value: any, name: any) => [`${value} heads`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Metric */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-black text-slate-900">{totalHerdCount}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heads</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-100">
                  {categories.map((cat) => (
                    <div
                      key={cat.name}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="font-bold">{cat.name}</span>
                      <span className="text-slate-400 font-semibold">({cat.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── 2. MONTHLY DAIRY YIELD OUTPUT (SMOOTH AREA CHART) ── */}
        <Card className="border-2 border-sky-900/10 bg-white shadow-xs rounded-3xl flex flex-col justify-between overflow-hidden hover:border-sky-700/30 transition-all">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
                  <Milk className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Monthly Dairy Yield Output
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Milk production volume trajectory in Liters (L)
                  </CardDescription>
                </div>
              </div>

              {data?.milk_production_liters ? (
                <Badge variant="outline" className="text-[10px] font-bold text-sky-800 bg-sky-50 border-sky-200">
                  {formatQty(data.milk_production_liters)} L this month
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
            {milkTrend.length === 0 ? (
              <div className="h-[230px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 my-2">
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-sky-900/10 mb-2.5">
                  <Milk className="size-6 text-sky-800" />
                </div>
                <p className="text-xs font-bold text-slate-700">No milk yields logged</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  Log your daily or weekly dairy milk harvest in the production dashboard.
                </p>
                <Button
                  size="sm"
                  onClick={() => router.push("/production-dashboard")}
                  className="mt-3 bg-sky-700 hover:bg-sky-800 text-white text-xs rounded-xl font-bold gap-1 cursor-pointer"
                >
                  <Package className="size-3.5" /> Log Production
                </Button>
              </div>
            ) : (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={milkTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="milkYieldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="period"
                        tickFormatter={formatPeriodMonth}
                        tick={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}L`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                        formatter={(val: any) => [`${formatQty(val)} Liters`, "Milk Harvest"]}
                        labelFormatter={(lbl: any) => `Period: ${formatPeriodMonth(lbl)}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="quantity"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#milkYieldGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-medium">Month-over-month trend</span>
                  <span className="font-bold text-sky-800">
                    {data?.milk_growth_pct !== null && data?.milk_growth_pct !== undefined
                      ? data.milk_growth_pct >= 0
                        ? `↑ +${data.milk_growth_pct.toFixed(1)}% vs last month`
                        : `↓ ${data.milk_growth_pct.toFixed(1)}% vs last month`
                      : "Steady output"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── 3. INSPECTION & CERTIFICATION STATUS (COMPLIANCE DONUT) ── */}
        <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl flex flex-col justify-between overflow-hidden hover:border-emerald-700/30 transition-all">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Inspection & Certification Status
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Municipal Agriculture Office audit compliance
                  </CardDescription>
                </div>
              </div>

              <Badge
                className={`text-[10px] font-bold px-2 py-0.5 border-0 ${
                  complianceRate >= 80
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {complianceRate}% Certified
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
            {statusBreakdown.length === 0 ? (
              <div className="h-[230px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 my-2">
                <ShieldCheck className="size-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">No inventory audit data</p>
              </div>
            ) : (
              <>
                <div className="h-[200px] w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={78}
                        stroke="#ffffff"
                        strokeWidth={2}
                        paddingAngle={3}
                      >
                        {statusBreakdown.map((entry, i) => (
                          <Cell key={`st-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                        formatter={(val: any, name: any) => [`${val} Heads`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center compliance score */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-black text-emerald-900">{complianceRate}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valid</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-100">
                  {statusBreakdown.map((st) => (
                    <div
                      key={st.name}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: st.color }} />
                      <span className="font-bold">{st.name}</span>
                      <span className="text-slate-400 font-semibold">({st.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── 4. HEALTH SURVEILLANCE & INCIDENT TRENDS (BAR CHART) ── */}
        <Card className="border-2 border-amber-900/10 bg-white shadow-xs rounded-3xl flex flex-col justify-between overflow-hidden hover:border-amber-700/30 transition-all">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-900">
                  <Activity className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Health Surveillance & Incident Trends
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Recent sickness cases vs mortality casualties
                  </CardDescription>
                </div>
              </div>

              <Badge variant="outline" className="text-[10px] font-bold text-amber-900 bg-amber-50 border-amber-200">
                Last 6 Months
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-center">
            {healthTrend.every((h) => h.disease === 0 && h.mortality === 0) ? (
              <div className="h-[230px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 my-2">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 mb-2">
                  <CheckCircle2 className="size-6 text-emerald-600" />
                </div>
                <p className="text-xs font-black text-slate-800">100% Healthy Herd Trajectory</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  No disease outbreaks or casualties reported in the past 6 months.
                </p>
              </div>
            ) : (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={healthTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="period"
                        tick={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      />
                      <Bar dataKey="disease" name="Sick Animals" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="mortality" name="Mortalities" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-amber-500" />
                    <span className="font-semibold text-slate-600">Sick Cases</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-rose-500" />
                    <span className="font-semibold text-slate-600">Mortalities</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
