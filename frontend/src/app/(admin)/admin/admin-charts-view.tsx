'use client';

import { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  ShieldCheck, Activity, Milk,
  RotateCw, CheckCircle2, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { useAdminDashboardAnalytics } from './admin-charts';

export function AdminChartsView({ data, isLoading, isFetching, isError, refetchAll }: ReturnType<typeof useAdminDashboardAnalytics>) {
  const [productionTimeframe, setProductionTimeframe] = useState<'6M' | '1Y'>('6M');

  const {
    barangayHerdDistribution,
    specieComposition,
    monthlyProduction,
    surveillanceTrends,
    sectorCompliance,
    vaccinationTotals,
  } = data;

  const slicedProduction =
    productionTimeframe === '6M' ? monthlyProduction.slice(-6) : monthlyProduction;

  return (
    <div className="space-y-3.5">
      {/* Visualizations Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#f0f7ee] text-[#2D5A27]">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 tracking-tight">Municipal Analytics & Visualizations</h3>
            <p className="text-[10px] text-slate-500 font-medium">Approved active inventory and approved dated events</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFetching && (
            <span className="text-xs font-bold text-[#2D5A27] flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 animate-spin" /> Syncing...
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => refetchAll()}
            disabled={isFetching}
            className="h-9 sm:h-9.5 px-3.5 sm:px-4 text-xs font-bold text-slate-700 hover:text-[#2D5A27] hover:border-[#2D5A27] hover:bg-emerald-50/50 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* ── ROW 1: Herd Distribution & Specie Composition ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Top Barangays Multi-Specie Breakdown */}
        <div className="lg:col-span-8 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#2D5A27]" />
                Top 7 Barangays by Current Heads
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Herd density breakdown per leading agricultural sector</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 text-emerald-800 bg-emerald-50 border-emerald-200">
                {data.totalBarangaysCount} Barangays Monitored
              </Badge>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <BarChart
                data={barangayHerdDistribution}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                barCategoryGap="20%"
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="barangay"
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px', padding: '8px 12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                <Bar dataKey="cattle" name="Cattle (Bovine)" stackId="a" fill="#2D5A27" maxBarSize={44} radius={[0, 0, 0, 0]} />
                <Bar dataKey="carabao" name="Carabao (Water Buffalo)" stackId="a" fill="#0284C7" maxBarSize={44} radius={[0, 0, 0, 0]} />
                <Bar dataKey="swine" name="Swine (Pigs)" stackId="a" fill="#F59E0B" maxBarSize={44} radius={[0, 0, 0, 0]} />
                <Bar dataKey="goat" name="Goats & Sheep" stackId="a" fill="#8B5CF6" maxBarSize={44} radius={[4, 4, 0, 0]} />
                <Bar dataKey="other" name="Other species" stackId="a" fill="#64748B" maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Specie Composition Donut */}
        <div className="lg:col-span-4 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-[#2D5A27]" />
                Specie Composition
              </h3>
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-slate-600 bg-slate-50 border-slate-200">
                Municipal Census
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mb-1">Percentage share of registered livestock types</p>

            <div className="h-[170px] w-full relative">
              <ResponsiveContainer width="100%" height="100%" debounce={150}>
                <PieChart>
                  <Pie
                    data={specieComposition}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {specieComposition.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Compact Legend Grid */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
            {specieComposition.map((specie) => (
              <div key={specie.name} className="flex items-center gap-1.5 p-1 rounded-md bg-slate-50 border border-slate-100">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: specie.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-slate-700 truncate">{specie.name}</div>
                  <div className="text-[9px] font-black text-slate-900">{specie.value.toLocaleString()} heads</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Monthly Milk Yield vs DA Quota & Biosecurity Surveillance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Milk Production vs Quota Composed Chart */}
        <div className="lg:col-span-7 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Milk className="w-3.5 h-3.5 text-sky-600" />
                Monthly Certified Milk Output
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Certified (APPROVED/VERIFIED) milking logs in liters</p>
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
              {(['6M', '1Y'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setProductionTimeframe(t)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${productionTimeframe === t ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <BarChart data={slicedProduction} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} L`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                <Bar dataKey="milk" name="Certified Milk (L)" fill="#0284C7" radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biosecurity & Disease Surveillance Area Chart */}
        <div className="lg:col-span-5 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Disease Incidence vs Mortality
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Certified cases reported vs. recorded livestock deaths</p>
            </div>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <AreaChart data={surveillanceTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReported" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDeaths" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E11D48" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E11D48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any, name: any) => [
                    isNaN(Number(value)) ? '0' : Number(value).toLocaleString(),
                    name,
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                <Area type="monotone" dataKey="reported" name="Case Incidence (Heads)" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorReported)" />
                <Area type="monotone" dataKey="deaths" name="Mortalities" stroke="#E11D48" strokeWidth={2} fillOpacity={1} fill="url(#colorDeaths)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Vaccination Coverage (full width) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Sector Vaccination Coverage */}
        <div className="lg:col-span-12 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#2D5A27]" />
                Sector Vaccination Coverage
              </h3>
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-slate-600 bg-slate-50 border-slate-200">
                Via Inventory Records
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mb-3">Share of certified inventories with a recorded vaccination date</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
              {sectorCompliance.map((sector) => {
                const safeRate = isNaN(Number(sector.rate)) ? 0 : Number(sector.rate);
                return (
                  <div key={sector.sector} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Brgy. {sector.sector}
                      </span>
                      <span className="font-black text-slate-900">{safeRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${safeRate >= 95 ? 'bg-emerald-600' : safeRate >= 90 ? 'bg-[#2D5A27]' : 'bg-amber-500'
                          }`}
                        style={{ width: `${Math.min(100, Math.max(0, safeRate))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 mt-2 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>Registered stock with vaccination date</span>
            <span className="text-emerald-700 font-bold">
              {vaccinationTotals.vaccinated.toLocaleString()} / {vaccinationTotals.total.toLocaleString()} vaccinated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AdminChartsView;
