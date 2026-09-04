"use client";

import { useState } from 'react';
import { PageHeader } from '@/app/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
    <>
      <PageHeader
          title="Reports & Analytics"
          subtitle="Generate and manage your farm data exports — Municipal Agriculture Office"
          icon={<FilePieChart className="h-6 w-6" />}
          variant="admin"
          maxWidthClass="max-w-4xl"
          mobileMenuOffset={false}
        />

        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

          {/* Generate Reports Section */}
          <section className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="bg-slate-50/70 border-b border-slate-200 p-4">
              <h3 className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-2">
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
          <section className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50/70 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm tracking-tight">
                <Clock className="w-4 h-4 text-[#2D5A27]" />
                Recent Reports
              </h3>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Report Details</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Format</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-50">
                {recentReports.length > 0 ? (
                  recentReports.map((report) => (
                    <TableRow key={report.id} className="group hover:bg-gray-50/80 transition-all border-none">
                      <TableCell className="px-6 py-4">
                        <div className="font-bold text-gray-800 group-hover:text-[#2D5A27] transition-colors">{report.type}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-1 font-medium">
                          <Calendar className="w-3.5 h-3.5" /> {report.dateRange}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`border-none text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                            report.format === 'PDF' ? 'bg-red-100 text-red-700' :
                            report.format === 'Excel' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {report.format}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <button className="inline-flex items-center gap-1.5 text-[#2D5A27] font-bold text-xs hover:text-[#1e3d1a] bg-[#f0f7ee] hover:bg-[#e2f0de] px-3.5 py-2 rounded-xl transition-all shadow-xs">
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                      No recent reports found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>

        </div>
    </>
  );
}
