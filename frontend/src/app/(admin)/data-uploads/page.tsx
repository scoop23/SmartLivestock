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
  UploadCloud,
  FileUp,
  Info,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

interface UploadHistory {
  code: string;
  type: 'Production' | 'Disease' | 'Inventory';
  fileName: string;
  records: number;
  status: 'Completed' | 'Processing' | 'Failed';
  uploadedBy: string;
  date: string;
}

export default function DataUploadsPage() {
  const [dataType, setDataType] = useState<'Production' | 'Disease' | 'Inventory'>('Production');
  const [dragActive, setDragActive] = useState(false);

  // Mock History Data
  const uploadHistory: UploadHistory[] = [
    { code: 'UP-9021', type: 'Production', fileName: 'march_milk_logs.csv', records: 124, status: 'Completed', uploadedBy: 'Juan Dela Cruz', date: '2026-04-20' },
    { code: 'UP-8955', type: 'Inventory', fileName: 'q1_cattle_update.xlsx', records: 45, status: 'Processing', uploadedBy: 'Juan Dela Cruz', date: '2026-04-24' },
    { code: 'UP-8812', type: 'Disease', fileName: 'vaccination_logs.csv', records: 12, status: 'Completed', uploadedBy: 'Admin Office', date: '2026-04-15' },
  ];

  return (
    <>
      <PageHeader
        title="Municipal Data Uploads"
        subtitle="Import bulk records into the livestock management system — Padre Garcia MAO"
        icon={<UploadCloud className="size-5 text-slate-800" />}
        variant="admin"
        maxWidthClass="w-full"
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5 pb-16 sm:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Upload Section */}
          <div className="lg:col-span-2 space-y-3.5">
            <section className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-4 sm:p-5">
              <h3 className="font-black text-slate-900 text-xs tracking-tight mb-3 flex items-center gap-2">
                <FileUp className="w-4 h-4 text-[#1E4D2B]" />
                Import Data Section
              </h3>

              <div className="space-y-3.5">
                {/* Data Type Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Target Data Domain</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Production', 'Disease', 'Inventory'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDataType(t)}
                        className={`h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          dataType === t
                            ? 'bg-[#1E4D2B] text-white border-[#1E4D2B] shadow-xs'
                            : 'bg-slate-50/80 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Upload Area */}
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    dragActive
                      ? 'border-[#1E4D2B] bg-emerald-50/40'
                      : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/60 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".csv, .xlsx, .xls"
                  />
                  <div className="size-12 rounded-2xl bg-emerald-100/60 text-[#1E4D2B] flex items-center justify-center mx-auto mb-2.5">
                    <UploadCloud className="size-6 text-[#1E4D2B]" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">Click to upload or drag and drop spreadsheet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Accepted formats: CSV, XLSX, XLS (Max 10MB per batch)</p>
                </div>

                {/* Notes */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3">
                  <div className="flex gap-2.5 items-start">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-black text-amber-900 uppercase tracking-wider">Formatting Advisory:</p>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed font-medium">
                        Ensure your file headers match the municipal schema for <strong>{dataType}</strong>.
                        Rows with formatting issues will be isolated in the validation audit queue.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full h-9 bg-[#1E4D2B] hover:bg-[#163b21] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Start Data Import
                </button>
              </div>
            </section>
          </div>

          {/* Guidelines Section */}
          <div className="lg:col-span-1">
            <section className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-4 sm:p-5 h-full flex flex-col justify-between">
              <div>
                <h3 className="font-black text-xs text-slate-900 mb-3.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#1E4D2B]" />
                  Compliance Guidelines
                </h3>
                <ul className="space-y-3">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#1E4D2B] text-[10px] flex items-center justify-center shrink-0 font-black">1</span>
                    <p className="text-xs text-slate-600 font-medium">Download the verified municipal template for your selected category.</p>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#1E4D2B] text-[10px] flex items-center justify-center shrink-0 font-black">2</span>
                    <p className="text-xs text-slate-600 font-medium">Ensure dates adhere strictly to <strong>YYYY-MM-DD</strong> ISO standard.</p>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#1E4D2B] text-[10px] flex items-center justify-center shrink-0 font-black">3</span>
                    <p className="text-xs text-slate-600 font-medium">For <strong>Inventory</strong>, livestock ear tags must be unique or tagged as new enrollments.</p>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#1E4D2B] text-[10px] flex items-center justify-center shrink-0 font-black">4</span>
                    <p className="text-xs text-slate-600 font-medium">Limit files to <strong>5,000 records</strong> per upload session for real-time validation.</p>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="mt-4 w-full h-9 border border-[#1E4D2B] text-[#1E4D2B] hover:bg-emerald-50/70 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Download Municipal Templates
              </button>
            </section>
          </div>
        </div>

        {/* History Table */}
        <section className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="bg-slate-50/70 border-b border-slate-100 px-4 py-3">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-xs tracking-tight">
              <Clock className="w-3.5 h-3.5 text-[#1E4D2B]" />
              Recent Upload History &amp; Audit Logs
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Code</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Type</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">File Name</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Records</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Status</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">By</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Date</TableHead>
                <TableHead className="px-4 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {uploadHistory.map((log) => (
                <TableRow key={log.code} className="group hover:bg-slate-50/80 transition-all border-none">
                  <TableCell className="px-4 py-2.5 text-xs font-mono font-bold text-[#1E4D2B]">{log.code}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs font-semibold text-slate-800">{log.type}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-slate-600 truncate max-w-[180px]">{log.fileName}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs font-bold text-center text-slate-800">{log.records}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Badge
                      variant="outline"
                      className={`border text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        log.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        log.status === 'Processing' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                        'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs font-medium text-slate-600">{log.uploadedBy}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-slate-400">{log.date}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#1E4D2B] transition-colors cursor-pointer" title="View Logs">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#1E4D2B] transition-colors cursor-pointer" title="Download File">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </>
  );
}
