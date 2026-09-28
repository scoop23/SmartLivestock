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
        title="Official Reports & Analytics"
        subtitle="Generate and manage municipal livestock data exports — Padre Garcia MAO"
        icon={<FileText className="size-5 text-slate-800" />}
        variant="admin"
        maxWidthClass="w-full"
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5 pb-16 sm:pb-6">
        {/* Generate Reports Section */}
        <section className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="bg-slate-50/70 border-b border-slate-100 px-4 py-3">
            <h3 className="font-black text-slate-900 text-xs tracking-tight flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#1E4D2B]" />
              Generate Official Report Package
            </h3>
          </div>

          <form onSubmit={handleGenerate} className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Report Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Report Domain</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E4D2B]/30 outline-none transition-all cursor-pointer"
                >
                  <option>Production Summary (Dairy & Cold Chain)</option>
                  <option>Livestock Inventory & Tag Roster</option>
                  <option>Health & Vaccination Surveillance Log</option>
                  <option>Sales & Commercial Financials</option>
                  <option>Feeding Activity & Cohort Nutrition</option>
                </select>
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Export Format</label>
                <div className="flex gap-2">
                  {['PDF', 'Excel', 'CSV'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`flex-1 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        format === f
                          ? 'bg-[#1E4D2B] text-white border-[#1E4D2B] shadow-xs'
                          : 'bg-slate-50/80 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date From */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Date Range From</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1E4D2B]/30"
                  />
                </div>
              </div>

              {/* Date To */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Date Range To</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1E4D2B]/30"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 w-full h-9 bg-[#1E4D2B] hover:bg-[#163b21] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Generate Official Report Package
            </button>
          </form>
        </section>

        {/* Recent Reports Section */}
        <section className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="bg-slate-50/70 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-xs tracking-tight">
              <Clock className="w-3.5 h-3.5 text-[#1E4D2B]" />
              Recent Export History
            </h3>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Report Details</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Format</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {recentReports.length > 0 ? (
                recentReports.map((report) => (
                  <TableRow key={report.id} className="group hover:bg-slate-50/80 transition-all border-none">
                    <TableCell className="px-4 py-2.5">
                      <div className="font-bold text-xs text-slate-800 group-hover:text-[#1E4D2B] transition-colors">{report.type}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                        <Calendar className="w-3 h-3" /> {report.dateRange}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={`border text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          report.format === 'PDF' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          report.format === 'Excel' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          'bg-sky-50 text-sky-800 border-sky-200'
                        }`}
                      >
                        {report.format}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <button className="inline-flex items-center gap-1 text-[#1E4D2B] font-bold text-xs hover:text-[#163b21] bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer">
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-8 text-center text-slate-400 text-xs italic">
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
