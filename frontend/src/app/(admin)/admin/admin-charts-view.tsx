'use client';

import { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Line
} from 'recharts';
import {
  TrendingUp, ShieldCheck, Activity, Milk, Scale,
  RotateCw, CheckCircle2, AlertCircle, BarChart3, PieChart as PieIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminDashboardAnalytics } from './admin-charts';

export function AdminChartsView() {
  const [productionTimeframe, setProductionTimeframe] = useState<'6M' | '1Y'>('6M');
  const { data, isLoading, isFetching, isError, refetchAll } = useAdminDashboardAnalytics();

  const {
    barangayHerdDistribution,
    specieComposition,
    monthlyProduction,
    surveillanceTrends,
    auctionTrends,
    sectorCompliance,
  } = data;

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
            <p className="text-[10px] text-slate-500 font-medium">Real-time aggregated metrics from inventory, census, and production logs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFetching && (
            <span className="text-[10px] font-bold text-[#2D5A27] flex items-center gap-1">
              <RotateCw className="w-3 h-3 animate-spin" /> Syncing...
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchAll()}
            disabled={isFetching}
            className="h-7 px-2.5 text-[11px] font-bold text-slate-700 hover:text-[#2D5A27] hover:border-[#2D5A27] transition-all cursor-pointer"
          >
            <RotateCw className={`w-3 h-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
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
                Top Barangays Specie Distribution
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Herd density breakdown per leading agricultural sector</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 text-emerald-800 bg-emerald-50 border-emerald-200">
                17 Barangays Monitored
              </Badge>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <BarChart data={barangayHerdDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="barangay" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px', padding: '8px 12px' }}
                  itemStyle={{ color: '#fff', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                <Bar dataKey="cattle" name="Cattle (Bovine)" stackId="a" fill="#2D5A27" radius={[0, 0, 0, 0]} />
                <Bar dataKey="carabao" name="Carabao (Water Buffalo)" stackId="a" fill="#0284C7" radius={[0, 0, 0, 0]} />
                <Bar dataKey="swine" name="Swine (Pigs)" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                <Bar dataKey="goat" name="Goats & Sheep" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
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
                Monthly Milk Output vs. DA Quota Target
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Dairy yield performance against Department of Agriculture target volume</p>
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
              <ComposedChart data={monthlyProduction} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} Liters`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                <Bar dataKey="milk" name="Actual Milk (L)" fill="#0284C7" radius={[4, 4, 0, 0]} barSize={22} />
                <Line type="monotone" dataKey="quota" name="DA Provincial Quota (L)" stroke="#EF4444" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biosecurity & Disease Surveillance Area Chart */}
        <div className="lg:col-span-5 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Biosecurity & Herd Surveillance
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Disease incidence, recoveries & quarantine control</p>
            </div>
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border-emerald-200">
              Low Outbreak Risk
            </Badge>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <AreaChart data={surveillanceTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReported" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                <Area type="monotone" dataKey="reported" name="Reported Symptoms" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorReported)" />
                <Area type="monotone" dataKey="recovered" name="Veterinary Recoveries" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorRecovered)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Auction Market & Sector Compliance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Auction Trading Trends */}
        <div className="lg:col-span-7 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-amber-600" />
                Padre Garcia Auction Volume & Gross Turnover
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">Headcount transacted vs. gross municipal trade value (₱M)</p>
            </div>
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 border-amber-200">
              National Cattle Capital
            </Badge>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <BarChart data={auctionTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any, name: any) => [
                    name.includes('Turnover') ? `₱${(Number(value) / 1000).toFixed(2)}M` : `${value} Heads`,
                    name
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                <Bar dataKey="headsTraded" name="Heads Transacted" fill="#2D5A27" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="grossTurnoverK" name="Turnover (₱k)" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Biosecurity & Vaccination Compliance */}
        <div className="lg:col-span-5 bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#2D5A27]" />
                Sector Vaccination Compliance
              </h3>
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border-emerald-200">
                94.6% Municipal Avg
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mb-3">Target compliance rate for FMD, Hemosep & Anthrax protection</p>

            <div className="space-y-2.5">
              {sectorCompliance.map((sector) => (
                <div key={sector.sector} className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Brgy. {sector.sector}
                    </span>
                    <span className="font-black text-slate-900">{sector.rate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${sector.rate >= 95 ? 'bg-emerald-600' : sector.rate >= 90 ? 'bg-[#2D5A27]' : 'bg-amber-500'
                        }`}
                      style={{ width: `${sector.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 mt-2 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>Mandatory biosecurity threshold: 85%</span>
            <span className="text-emerald-700 font-bold">All Sectors Passed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AdminChartsView;
