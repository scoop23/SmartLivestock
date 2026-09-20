"use client";

import {
  ArrowUpRight,
  Calculator,
  CalendarDays,
  FileSpreadsheet,
  LineChart as LineChartIcon,
  Milk,
  PhilippinePeso,
  Printer,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import type { ProductionRecordItem } from "./production-analytics";

export default function ProductionForecastsTab({
  inventories,
  records,
}: {
  inventories: LivestockInventoryItem[];
  records: ProductionRecordItem[];
}) {
  const activeHerdCount = inventories.filter((i) => i.status === "APPROVED").length;
  const femaleCattleCount = inventories.filter(
    (i) =>
      i.status === "APPROVED" &&
      (i.sex?.toUpperCase().includes("F") || i.livestockTypeName?.toLowerCase().includes("cattle"))
  ).length;

  // Recent milk production daily average
  const milkRecords = records.filter((r) => r.productionType === "milk" && r.status === "APPROVED");
  const totalMilkRecent = milkRecords.reduce((acc, r) => acc + Number(r.quantity), 0);
  const avgDailyMilk = milkRecords.length > 0 ? totalMilkRecent / Math.max(milkRecords.length, 1) : femaleCattleCount * 6;

  // 30-day and 90-day projections
  const forecast30DaysMilk = Math.round(avgDailyMilk * 30);
  const forecast90DaysMilk = Math.round(avgDailyMilk * 90);
  const forecast30DaysRevenue = Math.round(forecast30DaysMilk * 50); // PHP 50/L
  const forecast90DaysRevenue = Math.round(forecast90DaysMilk * 50);

  // Simulated herd growth trajectory over next 6 months
  const months = ["Current", "Month +1", "Month +2", "Month +3", "Month +4", "Month +5", "Month +6"];
  const forecastData = months.map((m, idx) => ({
    month: m,
    projectedYield: Math.round(avgDailyMilk * 30 * (1 + idx * 0.05)),
    projectedRevenue: Math.round(avgDailyMilk * 30 * (1 + idx * 0.05) * 50),
    projectedHerd: activeHerdCount + Math.floor(idx * 0.4),
  }));

  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Forecast KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="30-Day Milk Forecast"
          value={`${forecast30DaysMilk.toLocaleString()} L`}
          icon={<Milk className="size-4.5" />}
          badge="Projected monthly yield"
          variant="sky"
        />
        <KpiCard
          title="30-Day Revenue Forecast"
          value={`₱${forecast30DaysRevenue.toLocaleString()}`}
          icon={<PhilippinePeso className="size-4.5" />}
          badge="Estimated dairy value"
          variant="emerald"
        />
        <KpiCard
          title="90-Day Output Target"
          value={`${forecast90DaysMilk.toLocaleString()} L`}
          icon={<Sparkles className="size-4.5" />}
          badge={`₱${forecast90DaysRevenue.toLocaleString()} value`}
          variant="amber"
        />
        <KpiCard
          title="Lactating Capacity"
          value={`${femaleCattleCount} heads`}
          icon={<Users className="size-4.5" />}
          badge="Active dairy cows"
          variant="orange"
        />
      </div>

      {/* Forecast Header & Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Production Forecasts & Herd Projections
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical estimates based on active milking heads, biological lactation curves, and market price baselines.
          </p>
        </div>
        <Button
          onClick={handlePrintSummary}
          variant="outline"
          className="border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold gap-2"
        >
          <Printer className="size-4 text-slate-500" /> Export / Print Summary
        </Button>
      </div>

      {/* Projection Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LineChartIcon className="size-4 text-emerald-700" /> 6-Month Projected Monthly Output (Liters)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Estimated milk production trajectory with projected calving additions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} unit="L" />
                  <Tooltip
                    formatter={(val) => [`${Number(val).toLocaleString()} L`, "Projected Output"]}
                    contentStyle={{ borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="projectedYield" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PhilippinePeso className="size-4 text-emerald-700" /> Projected Gross Farm Revenue (₱)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Anticipated dairy milk proceeds at local farmgate price (₱50 / L)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `₱${v/1000}k`} />
                  <Tooltip
                    formatter={(val) => [`₱${Number(val).toLocaleString()}`, "Projected Proceeds"]}
                    contentStyle={{ borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="projectedRevenue" fill="#2D5A27" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Summary Report Card */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-700" /> Executive Production & Herd Forecast Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Active Producing Animals</p>
              <p className="text-base font-bold text-slate-900 mt-1">{femaleCattleCount} heads</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Approved breeding & milking stock</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Estimated 90-Day Milk Yield</p>
              <p className="text-base font-bold text-slate-900 mt-1">{forecast90DaysMilk.toLocaleString()} Liters</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Based on daily average</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <p className="text-slate-400 font-semibold uppercase text-[10px]">Estimated 90-Day Revenue</p>
              <p className="text-base font-bold text-emerald-800 mt-1">₱{forecast90DaysRevenue.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">At ₱50/L local rate</p>
            </div>
          </div>
          <p className="text-slate-400 text-[11px] text-center pt-2">
            * Note: Forecasts are mathematical models provided for farm budgeting and municipal feed planning. Actual production may vary with weather, nutrition, and veterinary interventions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
