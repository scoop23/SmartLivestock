'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/app/components/page-header';
import { AskAIBar } from '@/app/components/ask-ai-bar';
import {
  Users, CheckSquare, Map, TrendingUp, AlertTriangle,
  Sprout, FileText, Download, FileSpreadsheet,
  FileBarChart, Database
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';

export default function AdminDashboard() {
  const router = useRouter();

  // --- Handlers ---
  const handleExportExcel = (reportType: string) => {
    alert(`Generating ${reportType} report in Excel format...\nThis will download the report for Department of Agriculture submission.`);
  };

  const handleExportPDF = (reportType: string) => {
    alert(`Generating ${reportType} report in PDF format...\nThis will download the report for Department of Agriculture submission.`);
  };

  // --- Mock Data ---
  const statsCards = [
    { label: 'Total Cattle', value: '1,234', change: '+3.2%', icon: Sprout, color: 'bg-[#2D5A27]' },
    { label: 'Active Farmers', value: '156', change: '+5', icon: Users, color: 'bg-blue-600' },
    { label: 'Pending Records', value: '12', change: '-3', icon: CheckSquare, color: 'bg-yellow-600' },
    { label: 'Disease Alerts', value: '2', change: 'Active', icon: AlertTriangle, color: 'bg-[#D32F2F]' },
  ];

  const cattleDistribution = [
    { barangay: 'San Roque', cattle: 245 },
    { barangay: 'Banaba Ibaba', cattle: 198 },
    { barangay: 'Quilo-quilo', cattle: 167 },
    { barangay: 'Castillo', cattle: 143 },
    { barangay: 'Maugat', cattle: 121 },
  ];

  const monthlyProduction = [
    { month: 'Oct', milk: 95000, meat: 3200 },
    { month: 'Nov', milk: 97000, meat: 3400 },
    { month: 'Dec', milk: 94000, meat: 3100 },
    { month: 'Jan', milk: 98000, meat: 3500 },
    { month: 'Feb', milk: 99000, meat: 3600 },
    { month: 'Mar', milk: 99900, meat: 3700 },
  ];

  const livestockBreakdown = [
    { name: 'Dairy Cattle', value: 740, color: '#2D5A27' },
    { name: 'Beef Cattle', value: 494, color: '#5A8F4F' },
  ];

  return (
    <>
      <PageHeader
          title="LGU/MAO Dashboard"
          subtitle="Padre Garcia Municipal Agriculture Office — Livestock Monitoring & Analytics"
          variant="admin"
        />

        {/* AI Search Bar */}
        <div className="p-4 md:p-6 bg-white border-b border-slate-200 shadow-xs">
          <div className="max-w-7xl mx-auto">
            <AskAIBar />
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`${stat.color} text-white p-2.5 rounded-xl shadow-xs`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-slate-600 font-bold px-2 py-0.5 bg-slate-100 rounded-full">{stat.change}</span>
                  </div>
                  <p className="text-2xl font-black mb-0.5 text-slate-900 tracking-tight">{stat.value}</p>
                  <p className="text-xs text-slate-500 font-semibold">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
              <h3 className="font-black text-slate-900 text-base tracking-tight mb-4">Cattle Distribution by Barangay</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cattleDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="barangay" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="cattle" fill="#2D5A27" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
              <h3 className="font-black text-slate-900 text-base tracking-tight mb-4">Livestock Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={livestockBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {livestockBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Production Trends */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
            <h3 className="font-black text-slate-900 text-base tracking-tight mb-4">Monthly Production Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyProduction}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis yAxisId="left" orientation="left" stroke="#2D5A27" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#D32F2F" tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="milk" stroke="#2D5A27" name="Milk (L)" strokeWidth={3} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="meat" stroke="#D32F2F" name="Meat (kg)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Generate Reports Section */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-[#2D5A27]" />
              <h3 className="font-black text-slate-900 text-base tracking-tight">Generate Reports</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-6">
              Export comprehensive data for Municipal Agriculture Office (MAO) official submissions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Livestock Inventory', desc: 'Complete cattle census data', icon: Sprout, color: 'bg-[#2D5A27]/10', iconColor: 'text-[#2D5A27]' },
                { title: 'Production Summary', desc: 'Milk & meat production data', icon: TrendingUp, color: 'bg-blue-600/10', iconColor: 'text-blue-600' },
                { title: 'Disease & Mortality', desc: 'Health incidents & cases', icon: AlertTriangle, color: 'bg-red-600/10', iconColor: 'text-red-600' },
                { title: 'Farmer Registry', desc: 'Complete farmer database', icon: Users, color: 'bg-purple-600/10', iconColor: 'text-purple-600' },
                { title: 'Monthly Analytics', desc: 'Comprehensive data analysis', icon: FileBarChart, color: 'bg-orange-600/10', iconColor: 'text-orange-600' },
                { title: 'Full DA Submission', desc: 'Complete quarterly report', icon: Download, color: 'bg-[#2D5A27]/10', iconColor: 'text-[#2D5A27]' },
              ].map(({ title, desc, icon: Icon, color, iconColor }) => (
                <div key={title} className="border border-slate-200 rounded-2xl p-4 hover:border-[#2D5A27] transition-all bg-white group hover:shadow-xs">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 ${color} rounded-xl group-hover:scale-105 transition-transform`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-slate-900 mb-0.5 tracking-tight">{title}</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight">{desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExportExcel(title)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Excel
                    </button>
                    <button
                      onClick={() => handleExportPDF(title)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <FileBarChart className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Navigation Footer */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { path: '/data-overview', icon: Database, label: 'Data Overview' },
              { path: '/user-management', icon: Users, label: 'User Accounts' },
              { path: '/data-validation', icon: CheckSquare, label: 'Record Validation' },
              { path: '/gis-map', icon: Map, label: 'GIS Mapping' },
              { path: '/analytics', icon: TrendingUp, label: 'AI Analytics' },
            ].map(({ path, icon: Icon, label }) => (
              <button
                key={path}
                onClick={() => router.push(path)}
                className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 hover:border-[#2D5A27] hover:bg-[#2D5A27]/5 transition-all flex flex-col items-center justify-center text-center gap-2 group cursor-pointer"
              >
                <Icon className="w-5 h-5 text-[#2D5A27] group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
    </>
  );
}
