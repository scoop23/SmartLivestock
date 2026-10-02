'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/app/components/page-header';
import { AskAIBar } from '@/app/components/ask-ai-bar';
import {
  LayoutDashboard,
  Users, CheckSquare, Map, TrendingUp, AlertTriangle,
  FileText, Download, FileSpreadsheet,
  FileBarChart, Database, Milk, Scale, ChevronRight,
  ClipboardList
} from 'lucide-react';
import { Icon } from 'lucide-react';
import { cowHead } from '@lucide/lab';
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { AdminChartsView } from './admin-charts-view';
import { useAdminDashboardAnalytics } from './admin-charts';
import { ValidationLoadingScreen } from '@/components/validation-loading-screen';

const CowHeadIcon = ({ className }: { className?: string }) => (
  <Icon iconNode={cowHead} className={className} />
);

export default function AdminDashboard() {
  const router = useRouter();
  const analytics = useAdminDashboardAnalytics();
  const {
    data,
    isLoading,
    isError,
    refetchAll,
    dashboardSummaryQuery,
  } = analytics;

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="LGU/MAO Municipal Executive Dashboard"
          subtitle="Padre Garcia Municipal Agriculture Office — Livestock Surveillance, Yields & Commercial Trading"
          variant="admin"
          maxWidthClass="w-full"
          icon={<LayoutDashboard className="size-5 text-slate-800" />}
        />
        <div className="p-3 sm:p-4 md:p-5 w-full">
          <ValidationLoadingScreen
            title="Synchronizing Executive Analytics Dashboard"
            subtitle="Aggregating municipal livestock registries, 17-barangay census surveys, dairy production records, and biosecurity surveillance telemetry..."
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
                id: "production",
                label: "Dairy & Production Yields",
                sublabel: "Milk output & cold chain data",
                icon: <Milk className="size-4 shrink-0 text-blue-700" />,
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
      </>
    );
  }

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
  const statsCards: {
    label: string;
    value: string;
    change: string;
    icon: React.ReactNode;
    variant: KpiVariant;
    description: string;
  }[] = [
      {
        label: 'Total Livestock',
        value: (data.totalLivestock || 0).toLocaleString(),
        change: 'Live Registry',
        icon: <Icon iconNode={cowHead} className="size-5" />,
        variant: 'emerald',
        description: `Approved, active heads across ${data.totalBarangaysCount} barangays`
      },
      {
        label: 'Monthly Dairy Yield',
        value: data.monthlyDairyYieldL >= 1000
          ? `${(data.monthlyDairyYieldL / 1000).toFixed(1)}k L`
          : `${Math.round(data.monthlyDairyYieldL)} L`,
        change: 'This Month',
        icon: <Milk className="w-5 h-5" />,
        variant: 'sky',
        description: 'Certified milk intake'
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
        title="LGU/MAO Municipal Executive Dashboard"
        subtitle="Padre Garcia Municipal Agriculture Office — Livestock Surveillance, Yields & Commercial Trading"
        variant="admin"
        maxWidthClass="w-full"
        icon={<LayoutDashboard className="size-5 text-slate-800" />}
      />

      {/* AI Search Bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 shadow-2xs">
        <div className="w-full">
          <AskAIBar />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">
        {/* Executive Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {statsCards.map((stat) => (
            <KpiCard
              key={stat.label}
              title={stat.label}
              value={stat.value}
              icon={stat.icon}
              badge={stat.change}
              description={stat.description}
              variant={stat.variant}
            />
          ))}
        </div>

        {/* ── Visualizations & Charts Matrix ── */}
        <AdminChartsView {...analytics} />

        {/* ── Generate Reports ── */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-[#2D5A27]" />
            <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight">Generate Official Reports</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mb-3">
            Export comprehensive data packages for Department of Agriculture (DA) and Municipal Agriculture Office (MAO) submissions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {[
              { title: 'Livestock Inventory', desc: 'Complete cattle census', icon: CowHeadIcon, color: 'bg-emerald-50 text-emerald-800' },
              { title: 'Production Summary', desc: 'Milk & meat yield logs', icon: TrendingUp, color: 'bg-blue-50 text-blue-800' },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { path: '/data-overview', icon: Database, label: 'Data Overview' },
            { path: '/admin/census-analytics', icon: ClipboardList, label: 'Census Analytics' },
            { path: '/user-management', icon: Users, label: 'User Accounts' },
            { path: '/data-validation', icon: CheckSquare, label: 'Record Validation' },
            { path: '/gis-map', icon: Map, label: 'GIS Mapping' },
            { path: '/analytics', icon: TrendingUp, label: 'AI Analytics' },
          ].map(({ path, icon: IconComponent, label }) => (
            <button
              key={path}
              onClick={() => router.push(path)}
              className="bg-white p-2.5 sm:p-3 rounded-xl shadow-2xs border border-slate-200 hover:border-[#2D5A27] hover:bg-emerald-50/50 transition-all flex items-center justify-between text-left group cursor-pointer"
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
    </>
  );
}
