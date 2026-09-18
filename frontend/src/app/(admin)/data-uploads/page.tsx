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
        title="Data Uploads"
        subtitle="Import bulk records into the livestock management system — Municipal Agriculture Office"
        icon={<UploadCloud className="h-6 w-6" />}
        variant="admin"
        maxWidthClass="w-full"
        mobileMenuOffset={false}
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Upload Section */}
            <div className="lg:col-span-2 space-y-3.5">
              <section className="bg-white rounded-xl shadow-2xs border border-slate-200 p-3.5 sm:p-4">
                <h3 className="font-black text-slate-900 text-xs tracking-tight mb-3 flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-[#2D5A27]" />
                  Import Data Section
                </h3>

                <div className="space-y-3">
                  {/* Data Type Selection */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 block">Type of Data</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Production', 'Disease', 'Inventory'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDataType(t)}
                          className={`h-8.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${dataType === t
                            ? 'bg-[#2D5A27] text-white border-[#2D5A27]'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#2D5A27]'
                            }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* File Upload Area */}
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragActive ? 'border-[#2D5A27] bg-[#f0f7ee]' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                      }`}
                  >
                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".csv, .xlsx, .xls" />
                    <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-gray-700">Click to upload or drag and drop</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 italic">Accepted formats: CSV, XLSX, XLS (Max 10MB)</p>
                  </div>

                  {/* Notes */}
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <div className="flex gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Notes:</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Ensure your file headers match the system template for <strong>{dataType}</strong>.
                          Rows with errors will be skipped and reported in the log.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button className="w-full h-8.5 bg-[#2D5A27] text-white rounded-lg text-xs font-bold shadow-xs hover:bg-[#1e3d1a] transition-all cursor-pointer">
                    Start Data Import
                  </button>
                </div>
              </section>
            </div>

            {/* Guidelines Section */}
            <div className="lg:col-span-1">
              <section className="bg-white rounded-xl shadow-2xs border border-gray-200 p-3.5 sm:p-4 h-full flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-xs text-gray-800 mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2D5A27]" />
                    Guidelines
                  </h3>
                  <ul className="space-y-2.5">
                    <li className="flex gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-[#2D5A27] text-white text-[10px] flex items-center justify-center shrink-0 font-bold">1</span>
                      <p className="text-xs text-gray-600">Download the specific template for the data type you are uploading.</p>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-[#2D5A27] text-white text-[10px] flex items-center justify-center shrink-0 font-bold">2</span>
                      <p className="text-xs text-gray-600">Ensure dates are in <strong>YYYY-MM-DD</strong> format to avoid processing errors.</p>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-[#2D5A27] text-white text-[10px] flex items-center justify-center shrink-0 font-bold">3</span>
                      <p className="text-xs text-gray-600">For <strong>Inventory</strong>, livestock IDs must already exist or be marked as "New".</p>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-[#2D5A27] text-white text-[10px] flex items-center justify-center shrink-0 font-bold">4</span>
                      <p className="text-xs text-gray-600">Limit each upload to <strong>5,000 records</strong> per batch for optimal performance.</p>
                    </li>
                  </ul>
                </div>

                <button className="mt-4 w-full h-8.5 border-2 border-[#2D5A27] text-[#2D5A27] rounded-lg text-xs font-bold hover:bg-[#f0f7ee] transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Download Templates
                </button>
              </section>
            </div>
          </div>

          {/* History Table */}
          <section className="bg-white rounded-xl shadow-2xs border border-gray-200 overflow-hidden">
            <div className="bg-gray-50/70 border-b border-gray-100 px-3.5 py-2.5">
              <h3 className="font-black text-gray-800 flex items-center gap-2 text-xs tracking-tight">
                <Clock className="w-3.5 h-3.5 text-[#2D5A27]" />
                Recent Upload History
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Code</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Type</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">File Name</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Records</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Status</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">By</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Date</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-50">
                {uploadHistory.map((log) => (
                  <TableRow key={log.code} className="group hover:bg-gray-50/80 transition-all border-none">
                    <TableCell className="px-3.5 py-2 text-xs font-mono font-bold text-[#2D5A27]">{log.code}</TableCell>
                    <TableCell className="px-3.5 py-2 text-xs font-semibold text-gray-800">{log.type}</TableCell>
                    <TableCell className="px-3.5 py-2 text-xs text-gray-600 truncate max-w-[180px]">{log.fileName}</TableCell>
                    <TableCell className="px-3.5 py-2 text-xs font-bold text-center text-gray-800">{log.records}</TableCell>
                    <TableCell className="px-3.5 py-2">
                      <Badge
                        variant="outline"
                        className={`border-none text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          log.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          log.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3.5 py-2 text-xs font-medium text-gray-600">{log.uploadedBy}</TableCell>
                    <TableCell className="px-3.5 py-2 text-xs text-gray-400">{log.date}</TableCell>
                    <TableCell className="px-3.5 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#2D5A27] transition-colors cursor-pointer" title="View Logs">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#2D5A27] transition-colors cursor-pointer" title="Download File">
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
