'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { AskSmartLivestock } from '@/app/components/ask-smartlivestock';
import { PageHeader } from '@/app/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/axios';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface MonthlySurveillancePoint {
  month: string;
  label: string;
  reported_heads: number;
  deaths: number;
}

interface MonthlySalePoint {
  month: string;
  label: string;
  transactions: number | null;
  animals: number | null;
  total_value_php: number | null;
}

interface MonthlyInventoryRegistrationPoint {
  month: string;
  label: string;
  records: number;
  heads: number;
}

interface DashboardSummaryResponse {
  surveillance_series?: MonthlySurveillancePoint[];
  descriptive?: {
    period?: { start: string; end: string };
    disease?: { cases?: number; affected_heads?: number };
    mortality?: { records?: number; deaths?: number };
    sales?: { trend?: MonthlySalePoint[] };
    inventory_registration_trend?: MonthlyInventoryRegistrationPoint[];
    population?: {
      total_heads?: number;
      barangay_count?: number;
      by_barangay?: Array<{ barangay_id: number | null; heads: number }>;
    };
  };
}

interface PredictiveOverviewResponse {
  summary_cards?: Array<{
    domain: string;
    forecast_available: boolean;
    validation_status: string;
  }>;
}

interface PrescriptiveOverviewResponse {
  status: 'ready' | 'partial' | 'error';
  recommendations?: Array<{
    category: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    title: string;
    recommendation: string;
  }>;
}

type MetricTone = 'emerald' | 'blue' | 'rose' | 'amber';

const tones: Record<MetricTone, { icon: string; border: string }> = {
  emerald: { icon: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-100' },
  blue: { icon: 'bg-sky-100 text-sky-800', border: 'border-sky-100' },
  rose: { icon: 'bg-rose-100 text-rose-800', border: 'border-rose-100' },
  amber: { icon: 'bg-amber-100 text-amber-800', border: 'border-amber-100' },
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function TrendChart({
  title,
  description,
  data,
  color,
  kind,
  loading,
  rangeLabel,
  unit,
  chartId,
  footnote,
  emptyMessage,
}: {
  title: string;
  description: string;
  data: Array<{ label: string; value: number | null }>;
  color: MetricTone;
  kind: 'line' | 'bar';
  loading: boolean;
  rangeLabel: string;
  unit: string;
  chartId: 'affected-animals' | 'deaths' | 'inventory' | 'sales';
  footnote: string;
  emptyMessage: string;
}) {
  const chartColors: Record<MetricTone, { stroke: string; fill: string }> = {
    emerald: { stroke: '#07835d', fill: '#10b981' },
    blue: { stroke: '#2563eb', fill: '#60a5fa' },
    rose: { stroke: '#e11d48', fill: '#fb7185' },
    amber: { stroke: '#d97706', fill: '#fbbf24' },
  };
  const { stroke, fill } = chartColors[color];
  const hasValues = data.some((point) => point.value !== null);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label={title}>
      <div className="mb-3 flex items-start gap-2.5">
        <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${tones[color].icon}`}>
          {kind === 'line' ? <TrendingUp className="size-4" /> : <Activity className="size-4" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
          {rangeLabel}
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full sm:h-72" />
      ) : data.length && hasValues ? (
        <>
          <div className="h-64 w-full sm:h-72" role="img" aria-label={`${title} over ${rangeLabel.toLowerCase()}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: data.length > 8 ? 18 : 4 }}>
                <defs>
                  <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={fill} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={fill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  angle={data.length > 8 ? -35 : 0}
                  textAnchor={data.length > 8 ? 'end' : 'middle'}
                  height={data.length > 8 ? 42 : 28}
                  interval="preserveStartEnd"
                  minTickGap={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={(value) => Number(value).toLocaleString('en-PH')}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                  contentStyle={{ borderRadius: 12, borderColor: '#a7f3d0', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)' }}
                  labelStyle={{ color: '#065f46', fontWeight: 700 }}
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString('en-PH')} ${unit}`, title]}
                />
                {kind === 'line' ? (
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={title}
                    stroke={stroke}
                    strokeWidth={2.5}
                    fill={`url(#${chartId}-fill)`}
                    dot={{ r: 3.5, fill: stroke, stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill, stroke, strokeWidth: 2 }}
                    connectNulls
                  />
                ) : (
                  <Bar dataKey="value" name={title} fill={stroke} radius={[4, 4, 0, 0]} maxBarSize={42} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{footnote}</p>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-xs text-slate-500 sm:h-72">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

export default function AnalysisOverviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chartMonths, setChartMonths] = useState<6 | 12>(6);
  const role = user?.role?.toUpperCase();
  const canViewWeeklySurveillance = role === 'MAO' || role === 'ADMIN';
  const queryKey = ['analytics-overview', user?.email, user?.accessScope, user?.assignedBarangayId];

  const dashboardQuery = useQuery<DashboardSummaryResponse>({
    queryKey: [...queryKey, 'dashboard'],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<DashboardSummaryResponse>('analytics/dashboard/', { signal });
      return data;
    },
    staleTime: 60_000,
  });

  const predictiveOverviewQuery = useQuery<PredictiveOverviewResponse>({
    queryKey: [...queryKey, 'predictive-overview'],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PredictiveOverviewResponse>('analytics/predictive/diagnostics/', {
        params: { horizon: 6 },
        signal,
      });
      return data;
    },
    staleTime: 60_000,
  });

  const prescriptiveOverviewQuery = useQuery<PrescriptiveOverviewResponse>({
    queryKey: [...queryKey, 'prescriptive-overview'],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PrescriptiveOverviewResponse>('analytics/prescriptive/', { signal });
      return data;
    },
    staleTime: 60_000,
  });

  const population = dashboardQuery.data?.descriptive?.population;
  const barangays = population?.by_barangay ?? [];
  const coveredBarangays = barangays.filter((barangay) => barangay.heads > 0).length;
  const totalBarangays = population?.barangay_count ?? barangays.length;
  const diseaseReports = dashboardQuery.data?.descriptive?.disease;
  const mortality = dashboardQuery.data?.descriptive?.mortality;
  const inventorySeries = (dashboardQuery.data?.descriptive?.inventory_registration_trend ?? []).slice(-chartMonths);
  const salesSeries = (dashboardQuery.data?.descriptive?.sales?.trend ?? []).slice(-chartMonths);
  const availableSeries = dashboardQuery.data?.surveillance_series ?? [];
  const series = availableSeries.slice(-chartMonths);
  const forecastTopics = (predictiveOverviewQuery.data?.summary_cards ?? [])
    .filter((card) => card.domain.toLowerCase() !== 'production');
  const availableForecastCount = forecastTopics.filter((card) => card.forecast_available).length;
  const checkedForecastCount = forecastTopics.filter((card) => card.validation_status === 'VALIDATED').length;
  const suggestedActions = (prescriptiveOverviewQuery.data?.recommendations ?? [])
    .filter((recommendation) => recommendation.category.toUpperCase() !== 'PRODUCTION');
  const highPriorityActionCount = suggestedActions.filter((recommendation) => recommendation.severity === 'HIGH').length;
  const featuredAction = suggestedActions.find((recommendation) => recommendation.severity === 'HIGH') ?? suggestedActions[0];
  const rangeLabel = chartMonths === 6 ? 'Last 6 months' : 'Last 12 months';
  const chartPeriodLabel = series.length
    ? `${series[0].label} – ${series[series.length - 1].label}`
    : rangeLabel;
  const isFetching = dashboardQuery.isFetching || predictiveOverviewQuery.isFetching || prescriptiveOverviewQuery.isFetching;
  const period = dashboardQuery.data?.descriptive?.period;

  const exportReport = () => {
    const rows: Array<Array<string | number>> = [
      ['SmartLivestock Analytics Overview'],
      ['Chart period', chartPeriodLabel],
      ['Reporting period', period ? `${formatDate(period.start)} – ${formatDate(period.end)}` : ''],
      [],
      ['Summary', 'Value'],
      ['Approved active livestock heads', population?.total_heads ?? ''],
      ['Barangays with active livestock', coveredBarangays],
      ['Barangays in scope', totalBarangays],
      ['Disease reports in reporting period', diseaseReports?.cases ?? ''],
      ['Animals listed in disease reports', diseaseReports?.affected_heads ?? ''],
      ['Deaths in reporting period', mortality?.deaths ?? ''],
      [],
      ['Approved inventory registrations by month'],
      ['Month', 'Approved inventory records', 'Registered heads'],
      ...inventorySeries.map((row) => [row.label, row.records, row.heads]),
      [],
      ['Month', 'Animals listed in disease reports', 'Deaths reported'],
      ...series.map((point) => [point.label, point.reported_heads, point.deaths]),
      [],
      ['Monthly livestock sale activity'],
      ['Month', 'Approved sale transactions', 'Animals sold', 'Recorded sale value (PHP)'],
      ...salesSeries.map((point) => [point.label, point.transactions ?? '', point.animals ?? '', point.total_value_php ?? '']),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'smartlivestock-analytics-overview.csv';
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <PageHeader
        title="Analytics & Insights"
        subtitle="Livestock records and animal health reports for Padre Garcia."
        variant="admin"
        maxWidthClass="w-full"
        icon={<BarChart3 className="size-5 text-emerald-800" />}
      />

      <main className="mx-auto w-full max-w-screen-2xl space-y-4 px-4 py-4 pb-20 sm:px-6 sm:py-5 sm:pb-8 lg:px-8">
        <AnalyticsNav currentSection="overview" />

        <section aria-label="Trend analysis controls" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Monthly trend analysis</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Records over time</h2>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-700">
                  <CalendarDays className="size-3.5 text-emerald-700" />
                  {chartPeriodLabel}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Compare approved inventory, sale, disease, and death records by month.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Chart date range">
                {[6, 12].map((months) => (
                  <button
                    key={months}
                    type="button"
                    aria-pressed={chartMonths === months}
                    onClick={() => setChartMonths(months as 6 | 12)}
                    className={`rounded-md px-3 py-2 text-xs font-bold transition ${chartMonths === months ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {months} months
                  </button>
                ))}
              </div>
              <Link href="/analysis/descriptive" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
                <FileText className="size-3.5" />
                Detailed report
              </Link>
              <button
                type="button"
                onClick={exportReport}
                disabled={!dashboardQuery.data || dashboardQuery.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-3.5" />
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => { void queryClient.invalidateQueries({ queryKey }); }}
                disabled={isFetching}
                aria-label="Refresh analytics"
                title="Refresh analytics"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              {canViewWeeklySurveillance && (
                <button
                  type="button"
                  onClick={() => setAssistantOpen((open) => !open)}
                  aria-expanded={assistantOpen}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {assistantOpen ? 'Hide assistant' : 'Ask SmartLivestock'}
                </button>
              )}
            </div>
          </div>
        </section>

        {dashboardQuery.isError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
            <span>Analytics data could not be loaded. Try refreshing.</span>
            <button type="button" onClick={() => { void dashboardQuery.refetch(); }} className="font-bold underline underline-offset-2">
              Try again
            </button>
          </div>
        )}

        <section aria-label="Livestock and health graphs" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TrendChart
            title="Approved Inventory Registrations"
            description="Approved animal records, grouped by registration month"
            data={inventorySeries.map((row) => ({ label: row.label, value: row.heads }))}
            color="blue"
            kind="line"
            loading={dashboardQuery.isPending}
            rangeLabel={rangeLabel}
            unit="heads"
            chartId="inventory"
            footnote="Groups records currently marked approved by registration month. It is not a historical livestock headcount."
            emptyMessage="No approved inventory registrations are available for these months."
          />
          <TrendChart
            title="Approved Livestock Sales"
            description="Animals recorded in approved sales each month"
            data={salesSeries.map((point) => ({ label: point.label, value: point.animals }))}
            color="emerald"
            kind="bar"
            loading={dashboardQuery.isPending}
            rangeLabel={rangeLabel}
            unit="animals"
            chartId="sales"
            footnote="Only approved transfers are counted. Months without a sale record are left blank, not treated as confirmed zero sales."
            emptyMessage="No approved livestock sale records are available for these months."
          />
          <TrendChart
            title="Animals in Disease Reports"
            description="Animals listed as affected on approved reports"
            data={series.map((point) => ({ label: point.label, value: point.reported_heads }))}
            color="emerald"
            kind="line"
            loading={dashboardQuery.isPending}
            rangeLabel={rangeLabel}
            unit="animals"
            chartId="affected-animals"
            footnote="Monthly affected-animal counts on approved disease reports; reporting completeness is not measured."
            emptyMessage="Monthly disease report data is not available yet."
          />
          <TrendChart
            title="Deaths Reported"
            description="Deaths recorded in approved reports"
            data={series.map((point) => ({ label: point.label, value: point.deaths }))}
            color="rose"
            kind="bar"
            loading={dashboardQuery.isPending}
            rangeLabel={rangeLabel}
            unit="deaths"
            chartId="deaths"
            footnote="Monthly death counts in approved records; missing reports are not measured."
            emptyMessage="Monthly death report data is not available yet."
          />
        </section>

        <section aria-labelledby="advanced-overview-heading" className="space-y-3">
          <div>
            <h2 id="advanced-overview-heading" className="text-base font-bold tracking-tight text-slate-900">Predictive and prescriptive overview</h2>
            <p className="mt-1 text-xs text-slate-500">A quick look at forecast availability and suggested next steps.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <TrendingUp className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-800">Predictive</p>
                  <h3 className="mt-0.5 text-sm font-bold text-slate-900">Forecast availability</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Based on past approved records.</p>
                </div>
              </div>

              <div className="mt-4 min-h-[92px]">
                {predictiveOverviewQuery.isPending ? (
                  <div className="space-y-2" aria-label="Loading forecast overview">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ) : predictiveOverviewQuery.isError ? (
                  <p role="status" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">Forecast status could not be loaded.</p>
                ) : forecastTopics.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">No forecast topics are available for this account.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900">{availableForecastCount}/{forecastTopics.length}</span>{' '}
                        forecasts available
                      </p>
                      <p className="text-right text-[11px] text-slate-500">
                        <span className="block text-sm font-bold text-slate-800">{checkedForecastCount}</span>
                        checked against past data
                      </p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Available forecasts" aria-valuemin={0} aria-valuemax={forecastTopics.length} aria-valuenow={availableForecastCount}>
                      <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${(availableForecastCount / forecastTopics.length) * 100}%` }} />
                    </div>
                  </>
                )}
              </div>

              <Link href="/analysis/predictive" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 hover:text-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700">
                Open forecasts <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Lightbulb className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800">Prescriptive</p>
                  <h3 className="mt-0.5 text-sm font-bold text-slate-900">Suggested next steps</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Guidance from current health and vaccination records.</p>
                </div>
              </div>

              <div className="mt-4 min-h-[92px]">
                {prescriptiveOverviewQuery.isPending ? (
                  <div className="space-y-2" aria-label="Loading suggested actions">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : prescriptiveOverviewQuery.isError || prescriptiveOverviewQuery.data?.status === 'error' ? (
                  <p role="status" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">Suggested steps could not be loaded.</p>
                ) : suggestedActions.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">No health or vaccination suggestions are available from current records.</p>
                ) : (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">{suggestedActions.length} suggestions from current records</p>
                      {highPriorityActionCount > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">{highPriorityActionCount} high priority</span>
                      )}
                    </div>
                    {featuredAction && (
                      <>
                        <p className="text-xs font-bold text-slate-900">{featuredAction.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{featuredAction.recommendation}</p>
                      </>
                    )}
                    <p className="mt-2 text-[10px] text-slate-500">Suggestions are advisory and need staff review.</p>
                  </div>
                )}
              </div>

              <Link href="/analysis/prescriptive" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
                Open suggested actions <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

        {canViewWeeklySurveillance && assistantOpen && (
          <section aria-label="Ask SmartLivestock">
            <AskSmartLivestock className="w-full" collapsible={false} defaultOpen />
          </section>
        )}
      </main>
    </>
  );
}
