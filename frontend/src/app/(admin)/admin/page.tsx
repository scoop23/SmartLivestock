'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/app/components/page-header';
import { AskAIBar } from '@/app/components/ask-ai-bar';
import {
  Users, CheckSquare, Map, TrendingUp, AlertTriangle,
  Sprout, FileText, Download, FileSpreadsheet,
  FileBarChart, Database, Milk, Scale, ChevronRight
} from 'lucide-react';
import { Icon } from 'lucide-react';
import { cowHead } from '@lucide/lab';
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import { AdminChartsView } from './admin-charts-view';
import { useAdminDashboardAnalytics } from './admin-charts';

export default function AdminDashboard() {
  const router = useRouter();
  const { data } = useAdminDashboardAnalytics();

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
        value: (data.totalLivestock || 314).toLocaleString(),
        change: '+4.8% MoM',
        icon: <Icon iconNode={cowHead} className="size-5" />,
        variant: 'emerald',
        description: 'Across 17 Barangays'
      },
      {
        label: 'Monthly Dairy Yield',
        value: `${((data.monthlyDairyYieldL || 186400) / 1000).toFixed(1)}k L`,
        change: '+4.2% MoM',
        icon: <Milk className="w-5 h-5" />,
        variant: 'sky',
        description: 'Avg. 18.5 L/head/day'
      },
      {
        label: 'Auction Turnover',
        value: `₱${(data.auctionTurnoverM || 1.52).toFixed(2)}M`,
        change: 'Active Market',
        icon: <TrendingUp className="w-5 h-5" />,
        variant: 'amber',
        description: 'Padre Garcia Trading'
      },
      {
        label: 'Biosecurity Alerts',
        value: String(data.biosecurityAlerts || 2),
        change: 'Monitored',
        icon: <AlertTriangle className="w-5 h-5" />,
        variant: 'rose',
        description: '1 Quarantined sector'
      },
      {
        label: 'Registered Raisers',
        value: String(data.registeredFarmers || 156),
        change: '+8 New',
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
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
        <AdminChartsView />

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
              { title: 'Livestock Inventory', desc: 'Complete cattle census', icon: Sprout, color: 'bg-emerald-50 text-emerald-800' },
              { title: 'Production Summary', desc: 'Milk & meat yield logs', icon: TrendingUp, color: 'bg-blue-50 text-blue-800' },
              { title: 'Disease & Mortality', desc: 'Surveillance & clinical reports', icon: AlertTriangle, color: 'bg-rose-50 text-rose-800' },
              { title: 'Farmer Registry', desc: '18-Barangay raisers directory', icon: Users, color: 'bg-purple-50 text-purple-800' },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {[
            { path: '/data-overview', icon: Database, label: 'Data Overview' },
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
