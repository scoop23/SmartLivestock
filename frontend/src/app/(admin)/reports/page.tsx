"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/app/components/sidebar';
import { PageHeader } from '@/app/components/page-header';
import {
  FileText,
  Calendar,
  Download,
  Filter,
  FilePieChart,
  Clock
} from 'lucide-react';

interface Report {
  id: string;
  type: string;
  dateRange: string;
  format: 'PDF' | 'Excel' | 'CSV';
  generatedDate: string;
}

export default function ReportsPage() {
  const router = useRouter();

  // State for Form
  const [reportType, setReportType] = useState('Production Summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState('PDF');

  // Mock Data for Recent Reports
  const recentReports: Report[] = [
    { id: '1', type: 'Milk Production Monthly', dateRange: 'Mar 01 - Mar 31, 2026', format: 'PDF', generatedDate: '2 days ago' },
    { id: '2', type: 'Livestock Health Audit', dateRange: 'Jan 01 - Mar 31, 2026', format: 'Excel', generatedDate: '1 week ago' },
    { id: '3', type: 'Sales & Revenue Report', dateRange: 'Feb 01 - Feb 28, 2026', format: 'CSV', generatedDate: '3 weeks ago' },
  ];

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic for generation goes here
    alert(`Generating ${reportType} in ${format} format...`);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block">
        <Sidebar role="lgu" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <PageHeader
          title="Reports & Analytics"
          subtitle="Generate and manage your farm data exports"
          icon={<FilePieChart className="h-7 w-7" />}
          variant="admin"
          maxWidthClass="max-w-4xl"
          mobileMenuOffset={false}
        />

        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">

          {/* Generate Reports Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#2D5A27]" />
                Generate New Report
              </h3>
            </div>

            <form onSubmit={handleGenerate} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Report Type */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none transition-all"
                  >
                    <option>Production Summary</option>
                    <option>Livestock Inventory</option>
                    <option>Health & Vaccination Log</option>
                    <option>Sales & Financials</option>
                    <option>Feeding Activity</option>
                  </select>
                </div>

                {/* Format */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Export Format</label>
                  <div className="flex gap-3">
                    {['PDF', 'Excel', 'CSV'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${format === f
                          ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-[#2D5A27]'
                          }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Date From</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#2D5A27]"
                    />
                  </div>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Date To</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#2D5A27]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="mt-8 w-full bg-[#2D5A27] text-white py-3 rounded-lg font-bold hover:bg-[#1e3d1a] transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <FileText className="w-5 h-5" />
                Generate Report
              </button>
            </form>
          </section>

          {/* Recent Reports Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2D5A27]" />
                Recent Reports
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Report Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Format</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{report.type}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" /> {report.dateRange}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${report.format === 'PDF' ? 'bg-red-50 text-red-700 border border-red-100' :
                          report.format === 'Excel' ? 'bg-green-50 text-green-700 border border-green-100' :
                            'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                          {report.format}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="inline-flex items-center gap-1.5 text-[#2D5A27] font-bold text-sm hover:text-[#1e3d1a] bg-[#f0f7ee] px-3 py-1.5 rounded-lg transition-colors">
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {recentReports.length === 0 && (
              <div className="p-10 text-center text-gray-500 italic text-sm">
                No recent reports found.
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
