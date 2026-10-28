'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/axios';
import { getSpeciesColor } from '@/lib/species-colors';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Beef,
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Info,
  Layers,
  LineChart as LineChartIcon,
  MapPin,
  RefreshCw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  Line,
  LineChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DescriptiveResponse {
  descriptive: {
    period: { start: string; end: string };
    population: {
      total_heads: number;
      by_barangay: Array<{ barangay_id: number | null; barangay: string | null; heads: number; registered_farmers: number }>;
      by_species: Array<{ species_id: number; species: string; heads: number }>;
    };
    production: {
      records: number;
      by_type: Array<{ type: string; unit: string; quantity: number; records: number }>;
    };
    sales: {
      sales: number;
      animals: number;
      recorded_value: number | null;
      completed_transfers: number;
      missing_price_transfers: number;
      trend: Array<{ month: string; label: string; transactions: number | null; animals: number | null; total_value_php: number | null }>;
    };
    vaccination: {
      vaccinated: number;
      total: number;
      coverage_pct: number;
    };
  };
}

// Crisp Mission Control Tooltip matching futuristic design
function MissionControlTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-emerald-300 bg-white/95 p-3 text-xs text-slate-900 shadow-xl backdrop-blur-md">
      <div className="border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-emerald-800 font-bold">{label}</span>
        {unit && <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{unit}</span>}
      </div>
      <div className="space-y-1.5">
        {payload.map((item: any, index: number) => {
          if (item.value == null) return null;
          return (
            <div key={`${item.dataKey || item.name}-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: item.color || "#059669" }} />
                <span className="text-slate-600 font-medium">{item.name}</span>
              </div>
              <span className="font-mono font-bold text-slate-900">
                {Number(item.value).toLocaleString("en-PH", { maximumFractionDigits: 1 })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DescriptiveAnalyticsLandingPage() {
  const { user } = useAuth();
  const [selectedDomain, setSelectedDomain] = useState<'sales' | 'population' | 'production' | 'vaccination'>('sales');
  const [showTableView, setShowTableView] = useState(false);

  const query = useQuery<DescriptiveResponse>({
    queryKey: ['descriptive-landing', user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<DescriptiveResponse>('analytics/dashboard/', { signal });
      return data;
    },
    staleTime: 60_000,
  });

  const data = query.data?.descriptive;
  const loading = query.isPending;
  const isFetching = query.isFetching;

  const species = useMemo(() => {
    return data?.population.by_species ? [...data.population.by_species].sort((a, b) => b.heads - a.heads) : [];
  }, [data]);

  const topBarangays = useMemo(() => {
    return data?.population.by_barangay
      ? [...data.population.by_barangay]
          .filter((b) => b.barangay_id !== null)
          .sort((a, b) => b.heads - a.heads)
          .slice(0, 6)
      : [];
  }, [data]);

  const periodStartFormatted = data?.period?.start
    ? new Date(`${data.period.start}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const periodEndFormatted = data?.period?.end
    ? new Date(`${data.period.end}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const salesTrend = data?.sales.trend || [];

  return (
    <>
      <PageHeader
        title="Descriptive Intelligence"
        subtitle="Understand livestock populations, commodity yields, and barangay distributions from official Padre Garcia records"
        variant="admin"
        maxWidthClass="w-full"
        icon={<BarChart3 className="size-5 text-emerald-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8">
        <AnalyticsNav currentSection="descriptive" />

        {/* ----------------------------------------------------------------- */}
        {/* A. COMMAND BANNER (Futuristic Light Emerald Header)               */}
        {/* ----------------------------------------------------------------- */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 p-5 shadow-2xs">
          {/* Subtle decorative grid background glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 size-72 rounded-full bg-teal-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                  <Activity className="size-3.5 text-emerald-600 animate-pulse" />
                  Municipal Telemetry Engine
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-medium">Padre Garcia Batangas</span>
                {periodEndFormatted && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="size-3 text-slate-400" />
                      Window: {periodStartFormatted} – {periodEndFormatted}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                Descriptive Intelligence
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-mono font-bold">
                  v2.4 Core
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                Approved census snapshots, farmer-recorded production, reviewed operational data, and live transfers. Simple by default, detailed on demand.
              </p>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
              >
                <Link href="/analysis/municipal-records">
                  <FileSpreadsheet className="size-3.5 mr-1.5 text-emerald-600" />
                  Full Records Matrix
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
                disabled={isFetching}
                className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isFetching ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* B. INTERACTIVE DOMAIN SELECTOR (4 Segmented Cards)                */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'sales' as const,
              label: 'Live Transfers & Trade',
              domain: 'Commerce',
              reporting: 'Approved Transfers',
              icon: ShoppingBag,
              metric: `${data?.sales.completed_transfers ?? 0} transfers`,
              badge: `${data?.sales.animals ?? 0} animals`,
            },
            {
              id: 'population' as const,
              label: 'Livestock Census',
              domain: 'Population',
              reporting: 'Active Inventory',
              icon: Beef,
              metric: `${data?.population.total_heads?.toLocaleString('en-PH') ?? '0'} heads`,
              badge: `${species.length} species`,
            },
            {
              id: 'production' as const,
              label: 'Approved Yields',
              domain: 'Production',
              reporting: 'Commodity Logs',
              icon: Layers,
              metric: `${data?.production.records ?? 0} records`,
              badge: `${data?.production.by_type?.length ?? 0} commodities`,
            },
            {
              id: 'vaccination' as const,
              label: 'Vaccination Coverage',
              domain: 'Health',
              reporting: 'Immunity Records',
              icon: ShieldCheck,
              metric: `${data?.vaccination.coverage_pct ?? 0}% protected`,
              badge: `${data?.vaccination.vaccinated ?? 0} heads`,
            },
          ].map((card) => {
            const isSelected = selectedDomain === card.id;
            const Icon = card.icon;

            return (
              <button
                key={card.id}
                onClick={() => setSelectedDomain(card.id)}
                className={`group relative flex flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 border cursor-pointer ${
                  isSelected
                    ? 'border-2 border-emerald-600 bg-emerald-50/70 shadow-sm'
                    : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="size-4.5" />
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold ${
                      isSelected
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {card.badge}
                  </Badge>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                    {card.domain} • {card.reporting}
                  </div>
                  <div className={`text-sm font-bold transition-colors mt-0.5 ${
                    isSelected ? 'text-emerald-950 font-bold' : 'text-slate-800 group-hover:text-slate-900'
                  }`}>
                    {card.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span className="font-mono text-emerald-700 font-semibold">{card.metric}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Verified</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute -bottom-px left-4 right-4 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* C. MISSION CONTROL CENTERPIECE VISUALIZATION                     */}
        {/* ----------------------------------------------------------------- */}
        <Card className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                  {selectedDomain === 'sales' && <ShoppingBag className="size-4 text-emerald-700" />}
                  {selectedDomain === 'population' && <Beef className="size-4 text-emerald-700" />}
                  {selectedDomain === 'production' && <Layers className="size-4 text-emerald-700" />}
                  {selectedDomain === 'vaccination' && <ShieldCheck className="size-4 text-emerald-700" />}
                </div>
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                  {selectedDomain === 'sales' && 'Approved Live Animal Transfers Timeline'}
                  {selectedDomain === 'population' && 'Approved Population Distribution by Livestock Species'}
                  {selectedDomain === 'production' && 'Recorded Commodity Yield Output Breakdown'}
                  {selectedDomain === 'vaccination' && 'Vaccination Coverage & Biological Protection Meter'}
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                <span>Scope: <strong className="font-mono text-emerald-800">Padre Garcia Municipal Records</strong></span>
                <span>•</span>
                <span>Audit: <strong className="text-slate-700">Official Approved Transactions Only</strong></span>
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTableView((prev) => !prev)}
                className="h-8 border-slate-200 bg-white text-xs font-mono text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
              >
                {showTableView ? (
                  <>
                    <LineChartIcon className="size-3.5 mr-1 text-emerald-600" />
                    Show Visual Chart
                  </>
                ) : (
                  <>
                    <TableIcon className="size-3.5 mr-1 text-emerald-600" />
                    Inspect Numbers
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <Skeleton className="h-80 w-full rounded-xl bg-slate-100" />
            ) : query.isError ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-rose-200 rounded-xl bg-rose-50/50">
                <AlertTriangle className="size-8 text-rose-500 mb-2" />
                <h3 className="text-base font-bold text-slate-900">Telemetry Data Unavailable</h3>
                <p className="text-xs text-slate-600 max-w-md mt-1">
                  Could not load municipal descriptive analytics. Check network or database connectivity.
                </p>
                <Button onClick={() => void query.refetch()} size="sm" className="mt-3 bg-emerald-700 text-white font-bold text-xs">
                  Retry Query
                </Button>
              </div>
            ) : showTableView ? (
              /* Tabular Alternative for Precision & Accessibility */
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                {selectedDomain === 'sales' && (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="font-mono text-xs text-slate-600">Month Period</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Approved Transfers</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Animals Moved</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Recorded Value (PHP)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesTrend.map((row, idx) => (
                        <TableRow key={idx} className="border-slate-100 hover:bg-slate-50/70">
                          <TableCell className="font-mono text-xs font-semibold text-slate-900">{row.label}</TableCell>
                          <TableCell className="font-mono text-xs text-right font-bold text-emerald-800">
                            {row.transactions != null ? row.transactions.toLocaleString('en-PH') : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right text-slate-700">
                            {row.animals != null ? row.animals.toLocaleString('en-PH') : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right text-slate-700">
                            {row.total_value_php != null ? `₱${row.total_value_php.toLocaleString('en-PH')}` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {selectedDomain === 'population' && (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="font-mono text-xs text-slate-600">Species</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Active Inventory Heads</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Proportion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {species.map((row) => {
                        const total = data?.population.total_heads || 1;
                        const pct = Math.round((row.heads / total) * 100);
                        return (
                          <TableRow key={row.species_id} className="border-slate-100 hover:bg-slate-50/70">
                            <TableCell className="font-bold text-xs text-slate-900 flex items-center gap-2">
                              <span className="size-2 rounded-full" style={{ backgroundColor: getSpeciesColor(row.species) }} />
                              <span>{row.species}</span>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-emerald-800">
                              {row.heads.toLocaleString('en-PH')}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right text-slate-500">{pct}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {selectedDomain === 'production' && (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="font-mono text-xs text-slate-600">Commodity Type</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600">Measurement Unit</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Observed Yield</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Approved Entries</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.production.by_type ?? []).map((row) => (
                        <TableRow key={row.type} className="border-slate-100 hover:bg-slate-50/70">
                          <TableCell className="font-bold text-xs text-slate-900">{row.type}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">{row.unit}</TableCell>
                          <TableCell className="font-mono text-xs text-right font-bold text-emerald-800">
                            {row.quantity.toLocaleString('en-PH')}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right text-slate-700">
                            {row.records.toLocaleString('en-PH')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {selectedDomain === 'vaccination' && (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="font-mono text-xs text-slate-600">Vaccination Metric</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Value</TableHead>
                        <TableHead className="font-mono text-xs text-slate-600 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-slate-100">
                        <TableCell className="text-xs font-medium text-slate-800">Vaccinated Animals</TableCell>
                        <TableCell className="font-mono text-xs text-right font-bold text-emerald-800">
                          {data?.vaccination.vaccinated.toLocaleString('en-PH')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-mono">Protected</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-slate-100">
                        <TableCell className="text-xs font-medium text-slate-800">Eligible Herd Population</TableCell>
                        <TableCell className="font-mono text-xs text-right font-bold text-slate-700">
                          {data?.vaccination.total.toLocaleString('en-PH')}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-[11px] font-mono text-slate-500">Total Census</span>
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-slate-100">
                        <TableCell className="text-xs font-medium text-slate-800">Municipal Coverage Rate</TableCell>
                        <TableCell className="font-mono text-xs text-right font-extrabold text-emerald-700">
                          {data?.vaccination.coverage_pct}%
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-teal-100 text-teal-800 text-[10px] font-mono">Active Target</Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              /* Futuristic Visualizations */
              <div>
                {selectedDomain === 'sales' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-600 pb-2 border-b border-slate-100">
                      <span>Completed Transfers: <strong className="text-slate-900">{data?.sales.completed_transfers ?? 0}</strong></span>
                      <span>Distinct Animals: <strong className="text-slate-900">{data?.sales.animals ?? 0}</strong></span>
                      <span>
                        Recorded Value: <strong className="text-emerald-800">
                          {data?.sales.recorded_value == null ? 'Not recorded' : `₱${data.sales.recorded_value.toLocaleString('en-PH')}`}
                        </strong>
                      </span>
                    </div>

                    <div className="h-72 sm:h-80 w-full" role="img" aria-label="Monthly approved live animal transfers">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={salesTrend} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
                          <defs>
                            <linearGradient id="salesGlowLight" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                              <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis
                            dataKey="label"
                            stroke="#94a3b8"
                            tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                            axisLine={{ stroke: "#e2e8f0" }}
                            tickLine={{ stroke: "#e2e8f0" }}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                            axisLine={{ stroke: "#e2e8f0" }}
                            tickLine={{ stroke: "#e2e8f0" }}
                            tickFormatter={(v) => Number(v).toLocaleString("en-PH")}
                          />
                          <Tooltip content={<MissionControlTooltip unit="Transfers" />} />
                          <Area
                            type="monotone"
                            dataKey="transactions"
                            name="Approved Transfers"
                            stroke="none"
                            fill="url(#salesGlowLight)"
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="transactions"
                            name="Approved Transfers"
                            stroke="#059669"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "#10b981", stroke: "#047857", strokeWidth: 1.5 }}
                            activeDot={{ r: 6, fill: "#059669" }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {selectedDomain === 'population' && (
                  <div className="h-72 sm:h-80 w-full" role="img" aria-label="Livestock species bar chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={species} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="species"
                          stroke="#94a3b8"
                          tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={{ stroke: "#e2e8f0" }}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={{ stroke: "#e2e8f0" }}
                          tickFormatter={(v) => Number(v).toLocaleString("en-PH")}
                        />
                        <Tooltip content={<MissionControlTooltip unit="Heads" />} />
                        <Bar dataKey="heads" name="Registered Inventory" radius={[6, 6, 0, 0]}>
                          {species.map((entry) => (
                            <Cell key={entry.species_id} fill={getSpeciesColor(entry.species)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {selectedDomain === 'production' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(data?.production.by_type ?? []).map((row) => (
                        <div key={row.type} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-1">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                            Commodity: {row.type}
                          </span>
                          <div className="text-xl font-mono font-extrabold text-slate-900">
                            {row.quantity.toLocaleString('en-PH')} <span className="text-xs font-sans text-slate-500">{row.unit}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {row.records.toLocaleString('en-PH')} approved record entries
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDomain === 'vaccination' && (
                  <div className="space-y-5 p-4 rounded-xl bg-slate-50/60 border border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Municipal Herd Immunity Threshold</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Calculated from verified vaccination logs against active census counts
                        </p>
                      </div>
                      <div className="text-2xl font-mono font-black text-emerald-800">
                        {data?.vaccination.coverage_pct}%
                      </div>
                    </div>

                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                        style={{ width: `${Math.min(data?.vaccination.coverage_pct ?? 0, 100)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-3 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-400">Vaccinated Heads:</span>
                        <div className="text-base font-bold text-slate-900 mt-0.5">
                          {data?.vaccination.vaccinated.toLocaleString('en-PH')}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-400">Total Census Population:</span>
                        <div className="text-base font-bold text-slate-900 mt-0.5">
                          {data?.vaccination.total.toLocaleString('en-PH')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* D. EXECUTIVE METRIC CARDS (4 Sleek Cards)                         */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Active Heads Registered
              </span>
              <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                <Beef className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
                {data?.population.total_heads?.toLocaleString('en-PH') ?? '0'}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                Approved individual livestock inventory
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-cyan-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Approved Yield Entries
              </span>
              <div className="size-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-800">
                <Layers className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
                {data?.production.records?.toLocaleString('en-PH') ?? '0'}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                Eligible farmer production logs in system
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-teal-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Vaccination Coverage
              </span>
              <div className="size-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
                <ShieldCheck className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
                {data?.vaccination.coverage_pct ?? 0}%
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                {data?.vaccination.vaccinated?.toLocaleString('en-PH') ?? 0} of {data?.vaccination.total?.toLocaleString('en-PH') ?? 0} heads protected
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-amber-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Completed Transfers
              </span>
              <div className="size-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                <ShoppingBag className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
                {data?.sales.animals?.toLocaleString('en-PH') ?? '0'}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                {data?.sales.completed_transfers ?? 0} approved transfer events
              </p>
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* E. POPULATION BREAKDOWN PERSPECTIVES (Species & Barangays)        */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Leading Barangays */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                  <MapPin className="size-4 text-emerald-700" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Leading Barangays by Livestock Population
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Official head counts and registered farmer holdings
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <Skeleton className="h-60 w-full rounded-xl" />
              ) : topBarangays.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {topBarangays.map((b) => {
                    const total = data?.population.total_heads || 1;
                    const pct = Math.round((b.heads / total) * 100);
                    return (
                      <div key={b.barangay_id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-800">{b.barangay ?? 'Unmapped'}</span>
                          <span className="font-mono text-slate-600">
                            {b.heads.toLocaleString('en-PH')} heads ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 font-mono">No barangay records available.</div>
              )}
            </CardContent>
          </Card>

          {/* Species Distribution Summary */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
                  <Beef className="size-4 text-teal-700" />
                </div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Species Inventory Composition
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Approved heads per livestock classification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <Skeleton className="h-60 w-full rounded-xl" />
              ) : species.length > 0 ? (
                <div className="space-y-2.5 pt-2">
                  {species.map((s) => {
                    const total = data?.population.total_heads || 1;
                    const pct = Math.round((s.heads / total) * 100);
                    return (
                      <div key={s.species_id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: getSpeciesColor(s.species) }} />
                          <span className="font-bold text-slate-800">{s.species}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{s.heads.toLocaleString('en-PH')}</span>
                          <span className="text-[10px] font-mono text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 font-mono">No active species records.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* F. CALL TO ACTION FOR FULL MATRIX                                */}
        {/* ----------------------------------------------------------------- */}
        <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1.5 text-center sm:text-left">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Need complete monthly logs, slaughter records, or CSV exports?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Access the complete Municipal Records matrix to inspect monthly production trends, commodity valuation, disease and mortality causes, and export official municipal CSV reports.
            </p>
          </div>

          <Button asChild size="lg" className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold shrink-0 gap-2 cursor-pointer">
            <Link href="/analysis/municipal-records">
              <FileSpreadsheet className="size-4.5" />
              <span>Launch Municipal Records</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
