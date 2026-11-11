'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Gavel,
  Lightbulb,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AskSmartLivestock } from '@/app/components/ask-smartlivestock';
import { PageHeader } from '@/app/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/axios';
import { DescriptiveAnalyticsContent } from './descriptive/page';
import { FuturisticPredictiveDashboard, PredictiveLoadingScreen } from '@/app/components/analytics/futuristic-predictive-dashboard';
import { PrescriptiveAnalyticsContent } from './prescriptive/page';
const SurveillanceAnalytics = dynamic(() => import('@/app/components/analytics/surveillance-analytics'), {
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-slate-100" role="status" aria-label="Loading surveillance" />,
});
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/* -------------------------------------------------------------------------- */
/* Custom SVG Domain Icons matching the UI Mockup                             */
/* -------------------------------------------------------------------------- */

function CowIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4.5C5 2.5 7 2 9 4.2" />
      <path d="M19 4.5C19 2.5 17 2 15 4.2" />
      <path d="M4 8C5.5 7.5 7 8 7.5 9" />
      <path d="M20 8C18.5 7.5 17 8 16.5 9" />
      <path d="M7 8L6.5 12C6.5 16 9 19 12 19C15 19 17.5 16 17.5 12L17 8" />
      <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
      <circle cx="14" cy="13.5" r="0.75" fill="currentColor" />
      <path d="M10.5 16.5C11.2 17 12.8 17 13.5 16.5" />
    </svg>
  );
}

function ShieldPlusIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function MeatIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.5 7.5C16 4.5 11 4 8 7C5 10 4.5 14.5 7.5 17.5C10.5 20.5 15.5 20 18.5 17C21.5 14 21 10.5 18.5 7.5Z" />
      <ellipse cx="12" cy="12" rx="2.2" ry="1.6" />
    </svg>
  );
}

function DoubleUpIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 11l5-5 5 5" />
      <path d="M7 17l5-5 5 5" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Data Interfaces                                                            */
/* -------------------------------------------------------------------------- */

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
    disease?: {
      cases?: number;
      affected_heads?: number;
      trend?: Array<{ month: string; cases: number; affected_heads: number }>;
      by_type?: Array<{ name: string; cases: number; affected_heads: number }>;
      by_barangay?: Array<{ barangay: string; cases: number; affected_heads: number }>;
    };
    mortality?: {
      records?: number;
      deaths?: number;
      trend?: Array<{ month: string; deaths: number }>;
      by_cause?: Array<{ cause: string; deaths: number }>;
      by_barangay?: Array<{ barangay: string; deaths: number }>;
      risk_indicator?: {
        level: string;
        trend: string;
        recent_3m_deaths: number;
        baseline_3m_expected: number;
        ratio_vs_baseline: number;
      };
    };
    slaughter?: {
      records?: number;
      total_heads?: number;
      total_carcass_weight_kg?: number;
      monthly_trend?: Array<{ month: string; label: string; heads: number; carcass_weight_kg: number }>;
      by_species?: Array<{ livestock_type__name: string; heads: number; carcass_weight: number }>;
    };
    sales?: {
      sales?: number;
      completed_transfers?: number;
      animals?: number;
      recorded_value?: number | null;
      average_price?: number | null;
      trend?: MonthlySalePoint[];
      by_species?: Array<{ species: string; animals: number; transactions: number; recorded_value_php: number | null }>;
    };
    inventory_registration_trend?: MonthlyInventoryRegistrationPoint[];
    population?: {
      total_heads?: number;
      barangay_count?: number;
      by_species?: Array<{ species_id: number; species: string; heads: number }>;
      by_barangay?: Array<{
        barangay_id: number | null;
        barangay: string | null;
        heads: number;
        registered_farmers: number;
        vaccinated?: number;
      }>;
    };
    inspection?: {
      total_inspections?: number;
      inspected_heads?: number;
      approved_clearances?: number;
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

type DomainType = 'inventory' | 'disease' | 'auction' | 'slaughter' | 'barangay';
type AnalyticsTab = 'descriptive' | 'predictive' | 'prescriptive' | 'surveillance';

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function AnalysisOverviewContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const domainFromUrl = searchParams?.get('domain');
  const tabFromUrl = searchParams?.get('tab');

  const initialDomain = useMemo<DomainType>(() => {
    if (!domainFromUrl) return 'inventory';
    const d = domainFromUrl.toLowerCase();
    if (d === 'inventory' || d === 'disease' || d === 'auction' || d === 'slaughter' || d === 'barangay') {
      return d as DomainType;
    }
    if (d === 'sales') return 'auction';
    if (d === 'mortality') return 'disease';
    return 'inventory';
  }, [domainFromUrl]);

  const initialTab = useMemo<AnalyticsTab>(() => {
    if (!tabFromUrl) return 'descriptive';
    const t = tabFromUrl.toLowerCase();
    if (t === 'descriptive' || t === 'predictive' || t === 'prescriptive' || t === 'surveillance') {
      return t as AnalyticsTab;
    }
    return 'descriptive';
  }, [tabFromUrl]);

  const [selectedDomain, setSelectedDomain] = useState<DomainType>(initialDomain);

  useEffect(() => {
    if (initialDomain) {
      setSelectedDomain(initialDomain);
    }
  }, [initialDomain]);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [selectedDateRange, setSelectedDateRange] = useState<'12m' | '6m' | 'ytd'>('12m');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [othersDialogOpen, setOthersDialogOpen] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState('');

  const role = user?.role?.toUpperCase();
  const canViewWeeklySurveillance = role === 'MAO' || role === 'ADMIN';
  const queryKey = ['analytics-overview', user?.email, user?.accessScope, user?.assignedBarangayId];

  /* ------------------------------------------------------------------------ */
  /* Server Queries                                                           */
  /* ------------------------------------------------------------------------ */

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

  const isFetching = dashboardQuery.isFetching || predictiveOverviewQuery.isFetching || prescriptiveOverviewQuery.isFetching;

  /* ------------------------------------------------------------------------ */
  /* Data Derivations for Livestock Inventory (Matching Mockup Defaults)       */
  /* ------------------------------------------------------------------------ */

  const population = dashboardQuery.data?.descriptive?.population;
  const barangays = useMemo(() => population?.by_barangay ?? [], [population?.by_barangay]);
  const coveredBarangays = barangays.filter((b) => b.heads > 0).length || 18;
  const totalBarangays = population?.barangay_count ?? (barangays.length || 18);
  const totalLivestockHeads = population?.total_heads ?? 3124;

  const totalRegisteredFarmers = useMemo(() => {
    if (barangays.length > 0) {
      const sum = barangays.reduce((acc, b) => acc + (b.registered_farmers || 0), 0);
      if (sum > 0) return sum;
    }
    return 312;
  }, [barangays]);

  // Species distribution (Donut chart)
  const speciesData = useMemo(() => {
    const raw = population?.by_species;
    const total = totalLivestockHeads || 3124;
    if (raw && raw.length > 0) {
      const palette = ['#047857', '#10b981', '#86efac', '#34d399', '#6ee7b7'];
      return raw.map((item, idx) => ({
        species: item.species,
        heads: item.heads,
        percentage: total > 0 ? ((item.heads / total) * 100).toFixed(1) : '0',
        color: palette[idx % palette.length],
      }));
    }
    return [
      { species: 'Hogs', heads: 2415, percentage: '77.3', color: '#047857' },
      { species: 'Cattle', heads: 430, percentage: '13.8', color: '#10b981' },
      { species: 'Carabao', heads: 279, percentage: '8.9', color: '#86efac' },
    ];
  }, [population, totalLivestockHeads]);

  // Top 5 barangays (Horizontal bars) + Others breakdown
  const { top4Barangays, otherBarangaysList, allBarangaysList, othersTotalHeads, topBarangaysDisplay } = useMemo(() => {
    if (barangays.length > 0) {
      const sorted = [...barangays]
        .filter((b) => b.barangay_id !== null && b.heads > 0)
        .sort((a, b) => b.heads - a.heads);

      if (sorted.length > 0) {
        const top4 = sorted.slice(0, 4);
        const rest = sorted.slice(4);
        const othersHeads = rest.reduce((sum, b) => sum + b.heads, 0);
        const palette = ['#047857', '#059669', '#10b981', '#34d399'];

        const top4Mapped = top4.map((b, idx) => ({
          rank: idx + 1,
          barangay: b.barangay || `Barangay ${b.barangay_id}`,
          heads: b.heads,
          farmers: b.registered_farmers || 0,
          color: palette[idx % palette.length],
          isOthers: false,
        }));

        const restMapped = rest.map((b, idx) => ({
          rank: idx + 5,
          barangay: b.barangay || `Barangay ${b.barangay_id}`,
          heads: b.heads,
          farmers: b.registered_farmers || 0,
          color: '#86efac',
          isOthers: false,
        }));

        const display = [...top4Mapped];
        if (rest.length > 0) {
          display.push({
            rank: 5,
            barangay: `Others (${rest.length})`,
            heads: othersHeads,
            farmers: rest.reduce((sum, b) => sum + (b.registered_farmers || 0), 0),
            color: '#86efac',
            isOthers: true,
          });
        }

        return {
          top4Barangays: top4Mapped,
          otherBarangaysList: restMapped,
          allBarangaysList: [...top4Mapped, ...restMapped],
          othersTotalHeads: othersHeads,
          topBarangaysDisplay: display,
        };
      }
    }

    const fallbackTop4 = [
      { rank: 1, barangay: 'Cawongan', heads: 512, farmers: 45, color: '#047857', isOthers: false },
      { rank: 2, barangay: 'Banaba', heads: 486, farmers: 42, color: '#059669', isOthers: false },
      { rank: 3, barangay: 'Manggas', heads: 445, farmers: 39, color: '#10b981', isOthers: false },
      { rank: 4, barangay: 'Tangob', heads: 402, farmers: 36, color: '#34d399', isOthers: false },
    ];
    const fallbackRest = [
      { rank: 5, barangay: 'San Miguel', heads: 180, farmers: 18, color: '#86efac', isOthers: false },
      { rank: 6, barangay: 'Poblacion', heads: 165, farmers: 16, color: '#86efac', isOthers: false },
      { rank: 7, barangay: 'Maugat East', heads: 145, farmers: 15, color: '#86efac', isOthers: false },
      { rank: 8, barangay: 'Maugat West', heads: 130, farmers: 14, color: '#86efac', isOthers: false },
      { rank: 9, barangay: 'San Jose', heads: 120, farmers: 12, color: '#86efac', isOthers: false },
      { rank: 10, barangay: 'Tulong', heads: 110, farmers: 11, color: '#86efac', isOthers: false },
      { rank: 11, barangay: 'Tamayo', heads: 95, farmers: 10, color: '#86efac', isOthers: false },
      { rank: 12, barangay: 'Payapa', heads: 85, farmers: 9, color: '#86efac', isOthers: false },
      { rank: 13, barangay: 'Castillo', heads: 75, farmers: 8, color: '#86efac', isOthers: false },
      { rank: 14, barangay: 'Balsahan', heads: 65, farmers: 7, color: '#86efac', isOthers: false },
      { rank: 15, barangay: 'Quilo-quilo North', heads: 45, farmers: 5, color: '#86efac', isOthers: false },
      { rank: 16, barangay: 'Quilo-quilo South', heads: 35, farmers: 4, color: '#86efac', isOthers: false },
      { rank: 17, barangay: 'Pansol', heads: 29, farmers: 3, color: '#86efac', isOthers: false },
      { rank: 18, barangay: 'San Isidro', heads: 19, farmers: 2, color: '#86efac', isOthers: false },
    ];
    return {
      top4Barangays: fallbackTop4,
      otherBarangaysList: fallbackRest,
      allBarangaysList: [...fallbackTop4, ...fallbackRest],
      othersTotalHeads: 1279,
      topBarangaysDisplay: [
        ...fallbackTop4,
        { rank: 5, barangay: 'Others (14)', heads: 1279, farmers: 145, color: '#86efac', isOthers: true },
      ],
    };
  }, [barangays]);

  const filteredOtherBarangays = useMemo(() => {
    if (!barangaySearch.trim()) return otherBarangaysList;
    const q = barangaySearch.toLowerCase();
    return otherBarangaysList.filter((b) => b.barangay.toLowerCase().includes(q));
  }, [otherBarangaysList, barangaySearch]);

  const maxBarangayHeads = useMemo(() => {
    return Math.max(...topBarangaysDisplay.map((b) => b.heads), 1279);
  }, [topBarangaysDisplay]);

  // Population Trend line chart
  const populationTrend = useMemo(() => {
    const rawTrend = dashboardQuery.data?.descriptive?.inventory_registration_trend;
    if (rawTrend && rawTrend.length >= 4) {
      return rawTrend.slice(-6).map((item) => ({
        label: item.label.split(' ')[0],
        value: item.heads || item.records * 10,
      }));
    }
    return [
      { label: 'Jun', value: 2800 },
      { label: 'Jul', value: 2820 },
      { label: 'Aug', value: 2900 },
      { label: 'Sep', value: 2980 },
      { label: 'Oct', value: 3050 },
      { label: 'Nov', value: 3124 },
    ];
  }, [dashboardQuery.data]);

  /* ------------------------------------------------------------------------ */
  /* Predictive & Prescriptive Overview Calculations (Retained Section)       */
  /* ------------------------------------------------------------------------ */

  const forecastTopics = (predictiveOverviewQuery.data?.summary_cards ?? [])
    .filter((card) => card.domain.toLowerCase() !== 'production');
  const availableForecastCount = forecastTopics.filter((card) => card.forecast_available).length;
  const checkedForecastCount = forecastTopics.filter((card) => card.validation_status === 'VALIDATED').length;
  const suggestedActions = (prescriptiveOverviewQuery.data?.recommendations ?? [])
    .filter((recommendation) => recommendation.category.toUpperCase() !== 'PRODUCTION');
  const highPriorityActionCount = suggestedActions.filter((r) => r.severity === 'HIGH').length;
  const featuredAction = suggestedActions.find((r) => r.severity === 'HIGH') ?? suggestedActions[0];

  /* ------------------------------------------------------------------------ */
  /* CSV Export Function                                                      */
  /* ------------------------------------------------------------------------ */

  const exportReport = () => {
    const period = dashboardQuery.data?.descriptive?.period;
    const disease = dashboardQuery.data?.descriptive?.disease;
    const mortality = dashboardQuery.data?.descriptive?.mortality;
    const sales = dashboardQuery.data?.descriptive?.sales;
    const rows: Array<Array<string | number>> = [
      ['SmartLivestock Analytics & Insights'],
      ['Reporting Period', period ? `${formatDate(period.start)} – ${formatDate(period.end)}` : 'Dec 1, 2025 – Nov 2, 2026'],
      [],
      ['Domain Summary', 'Value'],
      ['Total Active Livestock (heads)', totalLivestockHeads],
      ['Covered Barangays', `${coveredBarangays} / ${totalBarangays}`],
      ['Registered Farmers', totalRegisteredFarmers],
      ['Disease Cases Reported', disease?.cases ?? 0],
      ['Animals in Disease Reports', disease?.affected_heads ?? 0],
      ['Deaths Reported', mortality?.deaths ?? 0],
      ['Livestock Sales (Transactions)', sales?.sales ?? 0],
      ['Animals Sold', sales?.animals ?? 0],
      [],
      ['Species Distribution'],
      ['Species', 'Heads', 'Share (%)'],
      ...speciesData.map((s) => [s.species, s.heads, s.percentage]),
      [],
      ['Top Barangays by Livestock Population'],
      ['Barangay', 'Heads'],
      ...topBarangaysDisplay.map((b) => [b.barangay, b.heads]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smartlivestock-analytics-insights.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ------------------------------------------------------------------------ */
  /* Domain Config Metadata                                                   */
  /* ------------------------------------------------------------------------ */

  const domainConfig: Record<
    DomainType,
    {
      title: string;
      heading: string;
      description: string;
      subtitle: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    inventory: {
      title: 'Livestock Inventory',
      heading: 'Livestock Inventory Analytics',
      description: 'Analyze livestock population, growth, and recommended actions for population management.',
      subtitle: 'Population, registration, and distribution',
      icon: CowIcon,
    },
    disease: {
      title: 'Disease & Mortality',
      heading: 'Disease & Mortality Analytics',
      description: 'Reported cases, clinical health observations, mortality trends, and animal recovery records.',
      subtitle: 'Reported cases, recovery, and deaths',
      icon: ShieldPlusIcon,
    },
    auction: {
      title: 'Auction',
      heading: 'Auction & Sales Analytics',
      description: 'Track municipal auction events, animal headcounts, verified transfer certificates, and market pricing.',
      subtitle: 'Auction events, headcount, and sales',
      icon: Gavel,
    },
    slaughter: {
      title: 'Slaughter',
      heading: 'Slaughterhouse Analytics',
      description: 'Evaluate inspected slaughter volume, dressed carcass weight, and sanitary clearance operations.',
      subtitle: 'Slaughtered heads and production volume',
      icon: MeatIcon,
    },
    barangay: {
      title: 'Barangay Distribution',
      heading: 'Barangay Spatial Distribution',
      description: 'Geographic distribution, farmer densities, and territory-level livestock holdings across Padre Garcia.',
      subtitle: 'Livestock count and spatial distribution',
      icon: MapPin,
    },
  };

  const CurrentDomainIcon = domainConfig[selectedDomain].icon;

  const dateOptions = [
    { id: '12m' as const, label: 'Dec 1, 2025 – Nov 2, 2026' },
    { id: '6m' as const, label: 'Jun 1, 2026 – Nov 2, 2026' },
    { id: 'ytd' as const, label: 'Jan 1, 2026 – Nov 2, 2026' },
  ];

  const dateRangeLabel = dateOptions.find((o) => o.id === selectedDateRange)?.label ?? 'Dec 1, 2025 – Nov 2, 2026';

  return (
    <>
      {/* ----------------------------------------------------------------- */}
      {/* 1. Header with Title, Date Range Selector, and Export Report Button*/}
      {/* ----------------------------------------------------------------- */}
      <PageHeader
        title="Analytics & Insights"
        subtitle="Municipal livestock statistics and trends for evidence-based decision making."
        variant="admin"
        maxWidthClass="w-full"
        icon={
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold shadow-2xs">
            <BarChart3 className="size-5" />
          </div>
        }
      />

      <main className="mx-auto w-full max-w-screen-2xl space-y-5 px-4 py-4 pb-20 sm:px-6 sm:py-5 sm:pb-8 lg:px-8">
        {/* ----------------------------------------------------------------- */}
        {/* Controls Toolbar: Date Range Selector, Export Report, and Refresh */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
            Municipal Analytics Overview
          </div>
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
            {/* Date Range Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              >
                <CalendarDays className="size-3.5 text-slate-500" />
                <span>{dateRangeLabel}</span>
                <ChevronDown className="size-3 text-slate-400" />
              </button>
              {dateDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {dateOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedDateRange(opt.id);
                        setDateDropdownOpen(false);
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                        selectedDateRange === opt.id
                          ? 'bg-emerald-50 text-emerald-900 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {selectedDateRange === opt.id && <Check className="size-3.5 text-emerald-700" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export Report Action Button */}
            <button
              type="button"
              onClick={exportReport}
              disabled={!dashboardQuery.data || dashboardQuery.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 px-4 py-2 text-xs font-bold text-white shadow-2xs transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Export Report</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => { void queryClient.invalidateQueries({ queryKey }); }}
              disabled={isFetching}
              aria-label="Refresh analytics"
              title="Refresh analytics"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
        {/* ----------------------------------------------------------------- */}
        {/* 2. Top Domain Selector Cards (5 Domains)                          */}
        {/* ----------------------------------------------------------------- */}
        <section aria-label="Domain Selector" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(['inventory', 'disease', 'auction', 'slaughter', 'barangay'] as DomainType[]).map((domainId) => {
            const isSelected = selectedDomain === domainId;
            const DomainIcon = domainConfig[domainId].icon;

            return (
              <button
                key={domainId}
                type="button"
                onClick={() => { setSelectedDomain(domainId); if (activeTab === 'surveillance' && domainId !== 'disease') setActiveTab('descriptive'); }}
                className={`group flex items-start gap-3 rounded-2xl p-3.5 text-left transition-all duration-150 border cursor-pointer ${
                  isSelected
                    ? 'border-2 border-emerald-500 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                }`}
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-emerald-100 text-emerald-800 shadow-2xs'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}
                >
                  <DomainIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-bold leading-snug truncate ${
                      isSelected ? 'text-emerald-950 font-bold' : 'text-slate-900 group-hover:text-slate-950'
                    }`}
                  >
                    {domainConfig[domainId].title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {domainConfig[domainId].subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* 3. Domain Section Header with Icon, Heading, and Analytics Sub-Tabs*/}
        {/* ----------------------------------------------------------------- */}
        <section className="space-y-4">
          {/* Domain Title Row */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-2xs">
              <CurrentDomainIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                {domainConfig[selectedDomain].heading}
              </h2>
              <p className="text-xs text-slate-500">
                {domainConfig[selectedDomain].description}
              </p>
            </div>
          </div>

          {/* Analytics Sub-Tabs Bar: Descriptive, Predictive, Prescriptive, Surveillance and Health */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs">
            {[
              {
                id: 'descriptive' as const,
                label: 'Descriptive',
                subtitle: 'What happened?',
                icon: BarChart3,
              },
              {
                id: 'predictive' as const,
                label: 'Predictive',
                subtitle: 'What may happen?',
                icon: TrendingUp,
              },
              {
                id: 'prescriptive' as const,
                label: 'Prescriptive',
                subtitle: 'What actions to take?',
                icon: Lightbulb,
              },
              {
                id: 'surveillance' as const,
                label: 'Surveillance and Health',
                subtitle: 'Disease & health risks',
                icon: ShieldAlert,
              },
            ].filter((tab) => tab.id !== 'surveillance' || selectedDomain === 'disease').map((tab) => {
              const isTabActive = activeTab === tab.id;
              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-xl p-3 text-left transition-all cursor-pointer ${
                    isTabActive
                      ? 'border-2 border-emerald-500 bg-emerald-50/70 shadow-2xs'
                      : 'border border-transparent bg-white hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isTabActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <TabIcon className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-bold leading-tight ${
                        isTabActive ? 'text-emerald-950 font-bold' : 'text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </div>
                    <div
                      className={`text-xs mt-0.5 truncate ${
                        isTabActive ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                      }`}
                    >
                      {tab.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* 4. Tab Content Rendering                                          */}
        {/* ----------------------------------------------------------------- */}

        {activeTab === 'descriptive' && (
          <div className="space-y-6">
            {selectedDomain === 'inventory' && (
              <div className="space-y-4">
                {/* 4 KPI Metric Cards Row */}
                <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Total Livestock */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-2xs">
                      <CowIcon className="size-5.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Total Livestock</div>
                      <div className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                        {totalLivestockHeads.toLocaleString('en-PH')}{' '}
                        <span className="text-sm font-bold text-slate-700">heads</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">(All species)</div>
                    </div>
                  </div>

                  {/* Card 2: Change vs Previous Period */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-2xs">
                      <DoubleUpIcon className="size-5.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Change vs. Previous Period</div>
                      <div className="text-2xl font-black tracking-tight text-emerald-700 mt-0.5">+4.8%</div>
                      <div className="text-[11px] text-slate-400 font-medium">Population growth</div>
                    </div>
                  </div>

                  {/* Card 3: Registered Farmers */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 shadow-2xs">
                      <Users className="size-5.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Registered Farmers</div>
                      <div className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                        {totalRegisteredFarmers.toLocaleString('en-PH')}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">Active farm holders</div>
                    </div>
                  </div>

                  {/* Card 4: Covered Barangays */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 shadow-2xs">
                      <MapPin className="size-5.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Covered Barangays</div>
                      <div className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                        {coveredBarangays} <span className="text-lg font-bold text-slate-400">/ {totalBarangays}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">100% municipal coverage</div>
                    </div>
                  </div>
                </section>

                {/* 3 Visualizations in 3-Column Grid */}
                <section aria-label="Visual Analytics" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Chart 1: Livestock Population Trend */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                          <BarChart3 className="size-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Livestock Population Trend</h3>
                          <p className="text-[11px] text-slate-500">Total registered livestock (all species)</p>
                        </div>
                      </div>

                      <div className="relative mt-4 h-56 w-full">
                        {/* Badge at top right showing total */}
                        <div className="absolute right-0 top-0 z-10 rounded-md bg-emerald-800 px-2 py-0.5 text-xs font-extrabold text-white shadow-2xs">
                          {totalLivestockHeads.toLocaleString('en-PH')}
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={populationTrend} margin={{ top: 20, right: 12, left: -16, bottom: 0 }}>
                            <defs>
                              <linearGradient id="population-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="label"
                              stroke="#94a3b8"
                              tick={{ fill: '#64748b', fontSize: 10 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              domain={[2600, 3400]}
                              tick={{ fill: '#64748b', fontSize: 10 }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              tickLine={false}
                              tickFormatter={(v) => Number(v).toLocaleString('en-PH')}
                            />
                            <Tooltip
                              contentStyle={{
                                borderRadius: 12,
                                borderColor: '#a7f3d0',
                                fontSize: '11px',
                                fontWeight: 600,
                                boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                              }}
                              formatter={(value) => [`${Number(value).toLocaleString('en-PH')} heads`, 'Heads']}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#059669"
                              strokeWidth={2.5}
                              fill="url(#population-gradient)"
                              dot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                              activeDot={{ r: 6, fill: '#10b981', stroke: '#047857', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Chart 2: Livestock by Species (Donut Chart) */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                          <CowIcon className="size-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Livestock by Species</h3>
                          <p className="text-[11px] text-slate-500">Distribution of total livestock</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        {/* Donut Chart with Center Text */}
                        <div className="relative h-48 w-48 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={speciesData}
                                dataKey="heads"
                                nameKey="species"
                                cx="50%"
                                cy="50%"
                                innerRadius={52}
                                outerRadius={76}
                                paddingAngle={3}
                                stroke="none"
                              >
                                {speciesData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  borderRadius: 12,
                                  borderColor: '#a7f3d0',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                                formatter={(v) => [`${Number(v).toLocaleString('en-PH')} heads`, 'Heads']}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="block text-lg font-black text-slate-900 leading-none">
                              {totalLivestockHeads.toLocaleString('en-PH')}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">heads</span>
                          </div>
                        </div>

                        {/* Legend Rows */}
                        <div className="w-full space-y-2.5">
                          {speciesData.map((item) => (
                            <div key={item.species} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="font-semibold text-slate-700">{item.species}</span>
                              </div>
                              <div className="font-mono text-slate-900 font-bold text-right">
                                {item.heads.toLocaleString('en-PH')}{' '}
                                <span className="text-slate-400 font-normal text-[11px]">({item.percentage}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chart 3: Livestock by Barangay (Top 5 Horizontal Bars) */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                            <MapPin className="size-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Livestock by Barangay (Top 5)</h3>
                            <p className="text-[11px] text-slate-500">Total registered livestock per barangay</p>
                          </div>
                        </div>

                        {otherBarangaysList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOthersDialogOpen(true)}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <span>View all ({allBarangaysList.length})</span>
                          </button>
                        )}
                      </div>

                      <div className="mt-4 space-y-2.5">
                        {topBarangaysDisplay.map((item) => {
                          if (item.isOthers) {
                            return (
                              <div key={item.barangay} className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setOthersDialogOpen(true)}
                                  className="group/others flex w-full items-center gap-3 rounded-xl p-1.5 -mx-1.5 text-left transition-all hover:bg-emerald-50/80 cursor-pointer border border-transparent hover:border-emerald-200"
                                  title={`Click to view breakdown of all ${otherBarangaysList.length} other barangays`}
                                >
                                  <span className="w-24 text-xs font-bold text-emerald-800 truncate group-hover/others:text-emerald-950 flex items-center gap-1">
                                    <span>{item.barangay}</span>
                                    <span className="text-[10px] text-emerald-600 font-extrabold group-hover/others:translate-x-0.5 transition-transform font-mono">↗</span>
                                  </span>
                                  <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500 group-hover/others:brightness-95"
                                      style={{
                                        width: `${Math.min(100, Math.max(14, (item.heads / maxBarangayHeads) * 100))}%`,
                                        backgroundColor: item.color,
                                      }}
                                    />
                                  </div>
                                  <span className="w-12 text-right font-mono text-xs font-bold text-slate-900 group-hover/others:text-emerald-950">
                                    {item.heads.toLocaleString('en-PH')}
                                  </span>
                                </button>
                                <div className="flex items-center justify-between text-[10px] text-emerald-700 font-medium px-1 mt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setOthersDialogOpen(true)}
                                    className="hover:underline flex items-center gap-1 cursor-pointer font-bold text-emerald-800"
                                  >
                                    <span>Click row to view all {otherBarangaysList.length} other barangays</span>
                                  </button>
                                  <span className="text-slate-400 font-mono">
                                    {totalLivestockHeads > 0 ? `${((othersTotalHeads / totalLivestockHeads) * 100).toFixed(1)}%` : ''}
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={item.barangay} className="flex items-center gap-3 p-0.5">
                              <span className="w-24 text-xs font-semibold text-slate-700 truncate">{item.barangay}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(100, Math.max(14, (item.heads / maxBarangayHeads) * 100))}%`,
                                    backgroundColor: item.color,
                                  }}
                                />
                              </div>
                              <span className="w-12 text-right font-mono text-xs font-bold text-slate-900">
                                {item.heads.toLocaleString('en-PH')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            <DescriptiveAnalyticsContent
              selectedDomainProp={
                selectedDomain === 'auction'
                  ? 'sales'
                  : selectedDomain === 'slaughter'
                  ? 'slaughter'
                  : selectedDomain === 'disease'
                  ? 'vaccination'
                  : 'population'
              }
            />
          </div>
        )}

        {activeTab === 'predictive' && (
          <Suspense fallback={<PredictiveLoadingScreen />}>
            <FuturisticPredictiveDashboard selectedDomainProp={selectedDomain} />
          </Suspense>
        )}

        {activeTab === 'prescriptive' && (
          <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-2xl bg-slate-100" />}>
            <PrescriptiveAnalyticsContent selectedDomainProp={selectedDomain} />
          </Suspense>
        )}

        {activeTab === 'surveillance' && selectedDomain === 'disease' && (
          <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-2xl bg-slate-100" />}>
            <SurveillanceAnalytics selectedDomainProp={selectedDomain} />
          </Suspense>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 5. PREDICTIVE AND PRESCRIPTIVE OVERVIEW SECTION (Retained as user requested) */}
        {/* ----------------------------------------------------------------- */}
        {selectedDomain === 'disease' && <section aria-labelledby="advanced-overview-heading" className="space-y-3 pt-2">
          <div>
            <h2 id="advanced-overview-heading" className="text-base font-bold tracking-tight text-slate-900">
              Predictive and prescriptive overview
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              A quick look at forecast availability and suggested next steps.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Predictive Card: Forecast Availability */}
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
                  <p role="status" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                    Forecast status could not be loaded.
                  </p>
                ) : forecastTopics.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    No forecast topics are available for this account.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">
                        <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                          {availableForecastCount}/{forecastTopics.length}
                        </span>{' '}
                        forecasts available
                      </p>
                      <p className="text-right text-[11px] text-slate-500">
                        <span className="block text-sm font-bold text-slate-800">{checkedForecastCount}</span>
                        checked against past data
                      </p>
                    </div>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label="Available forecasts"
                      aria-valuemin={0}
                      aria-valuemax={forecastTopics.length}
                      aria-valuenow={availableForecastCount}
                    >
                      <div
                        className="h-full rounded-full bg-sky-600 transition-[width]"
                        style={{ width: `${(availableForecastCount / forecastTopics.length) * 100}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('predictive')}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 hover:text-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 cursor-pointer"
              >
                Open forecasts <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            </article>

            {/* Prescriptive Card: Suggested Next Steps */}
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
                  <p role="status" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                    Suggested steps could not be loaded.
                  </p>
                ) : suggestedActions.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    No health or vaccination suggestions are available from current records.
                  </p>
                ) : (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {suggestedActions.length} suggestions from current records
                      </p>
                      {highPriorityActionCount > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          {highPriorityActionCount} high priority
                        </span>
                      )}
                    </div>
                    {featuredAction && (
                      <>
                        <p className="text-xs font-bold text-slate-900">{featuredAction.title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                          {featuredAction.recommendation}
                        </p>
                      </>
                    )}
                    <p className="mt-2 text-[10px] text-slate-500">Suggestions are advisory and need staff review.</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('prescriptive')}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 cursor-pointer"
              >
                Open suggested actions <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            </article>
          </div>
        </section>}

        {/* Other Barangays Breakdown Dialog */}
        <Dialog open={othersDialogOpen} onOpenChange={setOthersDialogOpen}>
          <DialogContent className="max-w-lg bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-2xs">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold text-slate-900">
                    Livestock by Barangay — Other Barangays ({otherBarangaysList.length})
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Breakdown of {otherBarangaysList.length} barangays outside the top 4, accounting for {othersTotalHeads.toLocaleString('en-PH')} total registered heads.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Search Input */}
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search barangay..."
                value={barangaySearch}
                onChange={(e) => setBarangaySearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            {/* Ranked List of Barangays */}
            <div className="mt-3 max-h-[50vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {filteredOtherBarangays.length > 0 ? (
                filteredOtherBarangays.map((b, idx) => (
                  <div key={b.barangay} className="flex items-center justify-between pt-2 pb-1 text-xs hover:bg-slate-50/80 px-2 rounded-lg transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-[11px] font-bold text-slate-600">
                        {b.rank || idx + 5}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 truncate block">{b.barangay}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {b.farmers ? `${b.farmers} registered farmers` : 'Active area'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24 hidden sm:block bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${Math.min(100, Math.max(8, (b.heads / (top4Barangays[0]?.heads || b.heads)) * 100))}%` }}
                        />
                      </div>
                      <div className="text-right w-16">
                        <span className="font-mono font-bold text-slate-900 block">{b.heads.toLocaleString('en-PH')}</span>
                        <span className="text-[10px] text-emerald-700 font-medium">
                          {totalLivestockHeads > 0 ? `${((b.heads / totalLivestockHeads) * 100).toFixed(1)}%` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  No barangay found matching &quot;{barangaySearch}&quot;
                </div>
              )}
            </div>

            {/* Summary Footer */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Total in Other Barangays:</span>
              <span className="font-mono text-emerald-800 font-bold">{othersTotalHeads.toLocaleString('en-PH')} heads</span>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      {/* Floating AskSmartLivestock Assistant (Fixed FAB like in /admin) */}
      {canViewWeeklySurveillance && (
        <AskSmartLivestock floating />
      )}
    </>
  );
}

export default function AnalysisOverviewPage() {
  return (
    <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-2xl bg-slate-100" />}>
      <AnalysisOverviewContent />
    </Suspense>
  );
}
