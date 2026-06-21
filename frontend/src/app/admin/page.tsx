'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { AskAIBar } from '../components/ask-ai-bar';
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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="lgu" onLogout={() => router.push('/')} />
      
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl mb-1 font-semibold">LGU/MAO Dashboard</h1>
            <p className="text-gray-600">Padre Garcia Municipal Agriculture Office</p>
          </div>
        </div>

        {/* AI Search Bar */}
        <div className="p-4 md:p-6 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <AskAIBar />
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statsCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${stat.color} text-white p-3 rounded-lg`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-sm text-gray-600 font-medium">{stat.change}</span>
                  </div>
                  <p className="text-2xl font-bold mb-1 text-gray-800">{stat.value}</p>
                  <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4">Cattle Distribution by Barangay</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cattleDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="barangay" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{fill: '#f9fafb'}} />
                  <Bar dataKey="cattle" fill="#2D5A27" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4">Livestock Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={livestockBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 className="font-bold text-gray-800 mb-4">Monthly Production Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyProduction}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" orientation="left" stroke="#2D5A27" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#D32F2F" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="milk" stroke="#2D5A27" name="Milk (L)" strokeWidth={3} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="meat" stroke="#D32F2F" name="Meat (kg)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Generate Reports Section */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-6 h-6 text-[#2D5A27]" />
              <h3 className="font-bold text-gray-800">Generate Reports</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
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
                <div key={title} className="border border-gray-200 rounded-lg p-4 hover:border-[#2D5A27] transition-all bg-white group">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 ${color} rounded-lg group-hover:scale-105 transition-transform`}>
                      <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-800 mb-0.5">{title}</h4>
                      <p className="text-[11px] text-gray-500 leading-tight">{desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExportExcel(title)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Excel
                    </button>
                    <button
                      onClick={() => handleExportPDF(title)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-semibold"
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
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-[#2D5A27] hover:bg-[#2D5A27]/5 transition-all flex flex-col items-center justify-center text-center gap-2 group"
              >
                <Icon className="w-6 h-6 text-[#2D5A27] group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}