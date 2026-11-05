'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { AskSmartLivestock } from '@/app/components/ask-smartlivestock';
import { PageHeader } from '@/app/components/page-header';
import { Button } from "@/components/ui/button";
import { KpiCard,type KpiVariant } from "@/components/ui/kpi-card";
import { HoverCard,HoverCardContent,HoverCardTrigger } from "@/components/ui/hover-card";
import { ValidationLoadingScreen, useSeamlessLoadingState } from '@/components/validation-loading-screen';
import { cowHead } from '@lucide/lab';
import {
  AlertTriangle,
  Building,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Icon,
  LayoutDashboard,
  Map,
  ShieldCheck,
  Scale,
  TrendingUp,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAdminDashboardAnalytics } from './admin-charts';
import { AdminChartsView } from './admin-charts-view';
import { AdminOperationsView } from './admin-operations-view';

const CowHeadIcon = ({ className }: { className?: string }) => (
  <Icon iconNode={cowHead} className={className} />
);

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const analytics = useAdminDashboardAnalytics();
  const {
    data,
    isLoading,
    isError,
    refetchAll,
    dashboardSummaryQuery,
  } = analytics;
  const { keepLoadingScreenMounted, showContent } = useSeamlessLoadingState(isLoading, {
    exitDurationMs: 500,
    contentDelayMs: 200,
  });
  const [clockString, setClockString] = useState<string>("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const updateTime = () => {
      setClockString(`${formatter.format(new Date())} PHT`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (isError) {
    return (
      <div className="p-6 space-y-3" role="alert">
        <p>Municipal dashboard data could not be loaded.</p>
        <Button variant="outline" onClick={() => refetchAll()}>
          Try Again
        </Button>
      </div>
    );
  }

  // --- Handlers ---
  const handleExportExcel = (reportType: string) => {
    alert(`Generating ${reportType} report in Excel format...\nThis will download the report for Department of Agriculture submission.`);
  };

  const handleExportPDF = (reportType: string) => {
    alert(`Generating ${reportType} report in PDF format...\nThis will download the report for Department of Agriculture submission.`);
  };

  // --- Executive Stats ---
  const vaccinationCoveragePct = data.vaccinationTotals.total
    ? Math.round((data.vaccinationTotals.vaccinated / data.vaccinationTotals.total) * 1000) / 10
    : 0;
  const sortedSpecies = [...data.specieComposition]
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const leadingSpecies = sortedSpecies.slice(0, 3);
  const additionalSpeciesCount = Math.max(data.specieComposition.length - leadingSpecies.length, 0);
  const speciesBreakdown = leadingSpecies.length
    ? `${leadingSpecies.map((species) => `${species.name} ${species.value.toLocaleString()}`).join(" · ")}${additionalSpeciesCount ? ` · +${additionalSpeciesCount} more types` : ""}`
    : "No approved, active livestock recorded";

  const statsCards: {
    label: string;
    value: string;
    change: string;
    icon: React.ReactNode;
    variant: KpiVariant;
    description: string;
    wrapText?: boolean;
  }[] = [
      {
        label: 'Approved Active Livestock',
        value: (data.totalLivestock || 0).toLocaleString(),
        change: 'All species',
        icon: <Icon iconNode={cowHead} className="size-5" />,
        variant: 'emerald',
        description: `Approved, active heads across ${data.totalBarangaysCount} barangays · ${speciesBreakdown}`,
        wrapText: true,
      },
      {
        label: 'Vaccination Coverage',
        value: `${vaccinationCoveragePct}%`,
        change: 'Current Inventory',
        icon: <ShieldCheck className="w-5 h-5" />,
        variant: 'emerald',
        description: `${data.vaccinationTotals.vaccinated.toLocaleString()} of ${data.vaccinationTotals.total.toLocaleString()} current heads have vaccination recorded`
      },
      {
        label: 'Pending Inventory Review',
        value: String(data.biosecurityAlerts || 0),
        change: 'Monitored',
        icon: <AlertTriangle className="w-5 h-5" />,
        variant: 'rose',
        description: 'Inventory entries awaiting review'
      },
      {
        label: 'Registered Raisers',
        value: String(data.registeredFarmers || 0),
        change: 'Approved Accounts',
        icon: <Users className="w-5 h-5" />,
        variant: 'default',
        description: 'Verified MAO farmers'
      },
    ];

  return (
    <>
      <PageHeader
        title="LGU/MAO Municipal Dashboard"
        subtitle="Padre Garcia Municipal Agriculture Office — Livestock Surveillance, Yields & Commercial Trading"
        variant="admin"
        maxWidthClass="w-full"
        icon={<LayoutDashboard className="size-5 text-slate-800" />}
      />

      <div className="relative min-h-[calc(100vh-10rem)]">
        {(isLoading || keepLoadingScreenMounted) && (
          <div className={`w-full px-4 sm:px-6 lg:px-8 py-6 ${showContent ? "absolute inset-0 z-30 pointer-events-none" : ""}`}>
            <ValidationLoadingScreen
              isLoading={isLoading}
              title="Synchronizing Municipal Analytics Dashboard"
              subtitle="Aggregating municipal livestock registries, 17-barangay census surveys, and biosecurity surveillance telemetry..."
              badgeLabel="Executive Stream Sync"
              authorityText="Municipal Agriculture Office • Padre Garcia, Batangas"
              items={[
                {
                  id: "inventory",
                  label: "Livestock Inventory",
                  sublabel: "Individual tags & herd registrations",
                  icon: <Icon iconNode={cowHead} className="size-4 shrink-0 text-emerald-700" />,
                  loaded: !dashboardSummaryQuery.isLoading && dashboardSummaryQuery.data !== undefined,
                },
                {
                  id: "census",
                  label: "Barangay Census Records",
                  sublabel: "17-Barangay household surveys",
                  icon: <FileSpreadsheet className="size-4 shrink-0 text-sky-700" />,
                  loaded: !dashboardSummaryQuery.isLoading && dashboardSummaryQuery.data !== undefined,
                },
                {
                  id: "barangays",
                  label: "Geographic Master Directory",
                  sublabel: "17 Municipal territorial sectors",
                  icon: <Map className="size-4 shrink-0 text-purple-700" />,
                  loaded: !dashboardSummaryQuery.isLoading && dashboardSummaryQuery.data !== undefined,
                },
              ]}
            />
          </div>
        )}

        {showContent && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out motion-reduce:animate-none">
            {/* Upper Micro-Telemetry Banner with Live Realtime Clock (No Transmit Telemetry Button) */}
            <div className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-2 sm:px-6 md:px-8">
              <div className="w-full flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-slate-500">
                <div className="flex items-center gap-2 font-semibold text-slate-600">
                  <Building className="size-3.5 text-emerald-600" />
                  <span>
                    MUNICIPAL JURISDICTION:{" "}
                    <strong className="font-mono text-slate-900 uppercase">
                      PADRE GARCIA, BATANGAS
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
                    <Clock className="size-3.5 text-slate-400" />
                    <span className="tabular-nums font-bold">
                      {clockString || "Loading Manila time…"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
              {/* Executive Stats Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
          {statsCards.map((stat) => {
            const card = (
              <KpiCard
                key={stat.label}
                title={stat.label}
                value={stat.value}
                icon={stat.icon}
                badge={stat.change}
                description={stat.description}
                variant={stat.variant}
                wrapText={stat.wrapText}
              />
            );

            if (stat.label !== "Total Livestock") return card;

            return (
              <HoverCard key={stat.label} openDelay={160} closeDelay={180}>
                <HoverCardTrigger asChild>
                  <div
                    tabIndex={0}
                    role="group"
                    aria-label="Total livestock across all species. Hover or focus to see the species breakdown."
                    className="h-full min-w-0 cursor-help rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    {card}
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  className="admin-species-depth-popover w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-emerald-200 bg-white p-4 shadow-xl"
                >
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">
                      Approved active livestock · all species
                    </p>
                    <p className="mt-1 text-lg font-black tracking-tight text-slate-900">
                      {data.totalLivestock.toLocaleString()} heads
                    </p>
                  </div>
                  {sortedSpecies.length ? (
                    <div className="max-h-56 space-y-1 overflow-y-auto" role="list" aria-label="Livestock heads by species">
                      {sortedSpecies.map((species) => (
                        <div key={species.name} role="listitem" className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-emerald-50/70">
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: species.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{species.name}</span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{species.value.toLocaleString()}</span>
                          <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-slate-500">{species.percentage ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">No approved, active livestock recorded.</p>
                  )}
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>

        {/* ── Visualizations & Charts Matrix ── */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
          <AdminOperationsView />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
          <AdminChartsView {...analytics} />
        </div>

        {/* ── Generate Reports ── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-5 sm:p-6 shadow-holo-card animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-[#2D5A27]" />
            <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight">Generate Official Reports</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            Export comprehensive data packages for Department of Agriculture (DA) and Municipal Agriculture Office (MAO) submissions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
            {[
              { title: 'Livestock Inventory', desc: 'Complete cattle census', icon: CowHeadIcon, color: 'bg-emerald-50 text-emerald-800' },
              { title: 'Disease & Mortality', desc: 'Surveillance & clinical reports', icon: AlertTriangle, color: 'bg-rose-50 text-rose-800' },
              { title: 'Farmer Registry', desc: `${data.totalBarangaysCount}-Barangay raisers directory`, icon: Users, color: 'bg-purple-50 text-purple-800' },
              { title: 'Auction Ledger', desc: 'Trading center transactions', icon: Scale, color: 'bg-amber-50 text-amber-800' },
              { title: 'Full DA Submission', desc: 'Quarterly compliance pack', icon: Download, color: 'bg-slate-100 text-slate-800' },
            ].map(({ title, desc, icon: IconComponent, color }) => (
              <div key={title} className="border border-slate-200/80 rounded-lg p-3 bg-white hover:border-[#2D5A27] transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`p-1.5 rounded-md ${color} shrink-0`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 truncate">{title}</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-tight line-clamp-1">{desc}</p>
                </div>
                <div className="flex gap-1.5 mt-2.5">
                  <button
                    onClick={() => handleExportExcel(title)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    Excel
                  </button>
                  <button
                    onClick={() => handleExportPDF(title)}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileBarChart className="w-3 h-3" />
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Navigation Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-250 fill-mode-both">
          {[
            { path: '/data-overview', icon: Database, label: 'Data Overview' },
            { path: '/admin/census-analytics', icon: ClipboardList, label: 'Census Analytics' },
            { path: '/user-management', icon: Users, label: 'User Accounts' },
            { path: '/data-validation', icon: CheckSquare, label: 'Record Validation' },
            { path: '/gis-map', icon: Map, label: 'GIS Mapping' },
            { path: '/analysis', icon: TrendingUp, label: 'AI Analytics' },
          ].map(({ path, icon: IconComponent, label }) => (
            <button
              key={path}
              onClick={() => router.push(path)}
              className="bg-white/95 backdrop-blur-xs p-3 rounded-2xl shadow-holo-card border border-slate-200/90 hover:border-emerald-600 hover:bg-emerald-50/50 transition-all flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-100 text-[#2D5A27] group-hover:bg-emerald-100 transition-colors">
                  <IconComponent className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">{label}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>
          </div>
        )}
      </div>

      {user?.role?.toUpperCase() === "MAO" && (
        <AskSmartLivestock floating />
      )}
    </>
  );
}
