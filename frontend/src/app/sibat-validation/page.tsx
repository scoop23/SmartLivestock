"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, ShieldCheck, ChevronLeft, 
  MessageSquare, Send, Activity, Milk, Beef, Scale, 
  CheckCircle2, AlertCircle, ClipboardCheck,
  Clock, Tag, DollarSign
} from "lucide-react";
import { Sidebar } from "../components/sidebar";
import { PageHeader } from "../components/page-header";
import MobileNavSibat from "../components/mobilenavsibat";

export default function SibatValidationPortal() {
  const router = useRouter();
  const [reviewingReport, setReviewingReport] = useState<any>(null);

  const [pendingRecords, setPendingRecords] = useState([
    { 
      id: "MLK-001", 
      farmer: "Maria Santos", 
      category: "Production",
      type: "Milk Production", 
      detail: "Holstein Herd", 
      quantity: "45",
      unit: "Liters",
      time: "Morning",
      date: "2026-04-26",
      location: "Purok 1, Lipay",
      description: "Standard morning yield from 5 cows.",
      status: "pending", 
      icon: <Milk className="text-blue-500" />
    },
    { 
      id: "SLG-002", 
      farmer: "Ricardo Gomez", 
      category: "Production",
      type: "Slaughter (Katay)", 
      tag: "TAG-9921", 
      liveWeight: "420",
      dressedWeight: "280",
      date: "2026-04-26",
      location: "Purok 2, Lipay",
      description: "Emergency slaughter due to leg injury (Non-disease).",
      status: "pending",
      icon: <Beef className="text-orange-600" />
    },
    { 
      id: "SAL-003", 
      farmer: "Elena Vilia", 
      category: "Production",
      type: "Live Cattle Sale", 
      heads: "2",
      totalKg: "850",
      price: "145,000",
      date: "2026-04-25",
      location: "Purok 5, Lipay",
      description: "Sold to buyer from Batangas City.",
      status: "pending",
      icon: <Scale className="text-emerald-600" />
    },
    { 
      id: "DIS-004", 
      farmer: "Juan Dela Cruz", 
      category: "Disease",
      type: "Health Report", 
      detail: "Brahman Bull", 
      metric: "1 Head", 
      location: "Purok 4, Lipay",
      description: "High fever and salivation observed. Possible FMD.",
      status: "pending", 
      icon: <Activity className="text-red-500" />
    }
  ]);

  const handleValidationAction = (newStatus: string) => {
    if (newStatus === "forwarded") {
      setPendingRecords(prev => prev.filter(r => r.id !== reviewingReport.id));
    } else {
      setPendingRecords(prev => prev.map(r => r.id === reviewingReport.id ? { ...r, status: newStatus } : r));
    }
    setReviewingReport(null);
  };

  const renderStatus = (record: any) => {
    if (record.category === "Disease") {
      if (record.status === "confirmed") return <span className="bg-red-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase flex items-center gap-1 shrink-0"><ShieldAlert size={10}/> Confirmed</span>;
      if (record.status === "false_alarm") return <span className="bg-emerald-500 text-white px-2 py-1 rounded text-[9px] font-black uppercase flex items-center gap-1 shrink-0"><ShieldCheck size={10}/> False Alarm</span>;
    } else {
      if (record.status === "verified") return <span className="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase flex items-center gap-1 shrink-0"><CheckCircle2 size={10}/> Verified</span>;
      if (record.status === "flagged") return <span className="bg-orange-500 text-white px-2 py-1 rounded text-[9px] font-black uppercase flex items-center gap-1 shrink-0"><AlertCircle size={10}/> Flagged</span>;
    }
    return <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-black uppercase shrink-0">Pending Review</span>;
  };

  // INDIVIDUAL REPORT DETAIL VIEW
  if (reviewingReport) {
    const isDisease = reviewingReport.category === "Disease";
    const type = reviewingReport.type;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col mb-16 lg:mb-0">
        <PageHeader
          title="Process Submission"
          variant="sibat"
          mobileMenuOffset={false}
          icon={
            <button onClick={() => setReviewingReport(null)} className="rounded-full p-2 transition-colors hover:bg-white/10" aria-label="Back to submissions">
              <ChevronLeft />
            </button>
          }
        />

        <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex gap-4 mb-6 border-b pb-4">
                  <div className="w-12 h-12 bg-slate-50 border rounded-xl flex items-center justify-center text-2xl shrink-0">{reviewingReport.icon}</div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 leading-tight">{reviewingReport.type}</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{reviewingReport.farmer} • {reviewingReport.location}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {type === "Milk Production" && (
                    <>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-[10px] font-black text-blue-400 uppercase">Quantity</p>
                        <p className="font-black text-blue-900 text-lg">{reviewingReport.quantity} L</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-[10px] font-black text-blue-400 uppercase">Time</p>
                        <p className="font-black text-blue-900 flex items-center gap-1"><Clock size={14}/> {reviewingReport.time}</p>
                      </div>
                    </>
                  )}

                  {type === "Slaughter (Katay)" && (
                    <>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-[10px] font-black text-orange-400 uppercase">Tag #</p>
                        <p className="font-black text-orange-900 flex items-center gap-1"><Tag size={14}/> {reviewingReport.tag}</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-[10px] font-black text-orange-400 uppercase">Live Weight</p>
                        <p className="font-black text-orange-900">{reviewingReport.liveWeight} kg</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-[10px] font-black text-orange-400 uppercase">Dressed</p>
                        <p className="font-black text-orange-900">{reviewingReport.dressedWeight} kg</p>
                      </div>
                    </>
                  )}

                  {type === "Live Cattle Sale" && (
                    <>
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <p className="text-[10px] font-black text-emerald-400 uppercase">Heads</p>
                        <p className="font-black text-emerald-900">{reviewingReport.heads}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <p className="text-[10px] font-black text-emerald-400 uppercase">Total Weight</p>
                        <p className="font-black text-emerald-900">{reviewingReport.totalKg} kg</p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <p className="text-[10px] font-black text-emerald-400 uppercase">Price</p>
                        <p className="font-black text-emerald-900 flex items-center gap-1"><DollarSign size={14}/> {reviewingReport.price}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 p-4 bg-slate-50 border rounded-lg text-sm italic text-gray-600">
                  <p className="text-[10px] font-black text-gray-400 uppercase not-italic mb-1 tracking-widest">Farmer's Note</p>
                  "{reviewingReport.description}"
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-xs font-black uppercase text-gray-400 mb-4 tracking-widest flex items-center gap-2"><MessageSquare size={14}/> Validation Audit Notes</h3>
                <textarea className="w-full p-4 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600" rows={3} placeholder="Confirm weights, health status, or price details..."/>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-xs font-black uppercase text-gray-400 mb-6 tracking-widest flex items-center gap-2"><ClipboardCheck size={14}/> Decision</h3>
                <div className="space-y-3">
                  {isDisease ? (
                    <>
                      <button onClick={() => handleValidationAction('confirmed')} className="w-full flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50 text-red-700 font-black text-[11px] uppercase hover:bg-red-100 transition-all">Confirmed Case <ShieldAlert size={18}/></button>
                      <button onClick={() => handleValidationAction('false_alarm')} className="w-full flex items-center justify-between p-4 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 font-black text-[11px] uppercase hover:bg-emerald-100 transition-all">False Alarm <ShieldCheck size={18}/></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleValidationAction('verified')} className="w-full flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 font-black text-[11px] uppercase hover:bg-blue-100 transition-all">Approve Entry <CheckCircle2 size={18}/></button>
                      <button onClick={() => handleValidationAction('flagged')} className="w-full flex items-center justify-between p-4 rounded-xl border border-orange-100 bg-orange-50 text-orange-700 font-black text-[11px] uppercase hover:bg-orange-100 transition-all">Flag for Review <AlertCircle size={18}/></button>
                    </>
                  )}
                  <button onClick={() => handleValidationAction('forwarded')} className="w-full bg-[#1A365D] text-white py-4 mt-6 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20">Forward to MAO <Send size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <MobileNavSibat />
      </div>
    );
  }

  // MAIN TABLE LIST VIEW
  return (
    <div className="flex min-h-screen bg-gray-50 mb-16 lg:mb-0">
      <div className="hidden lg:block"><Sidebar role="sibat" onLogout={() => router.push('/')} /></div>
      <main className="flex flex-col w-full overflow-hidden">
        <PageHeader
          title="SIBAT"
          subtitle="Validated Production & Health Queue"
          variant="sibat"
          mobileMenuOffset={false}
        />

        <div className="p-4 lg:p-6">
          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
            {/* WRAPPER FOR HORIZONTAL SCROLL ON MOBILE */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b bg-slate-50">
                    <th className="p-6">Category / Farmer</th>
                    <th className="p-6">Status</th>
                    <th className="p-6">Entry Summary</th>
                    <th className="p-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white border rounded-lg flex items-center justify-center shadow-sm shrink-0">{record.icon}</div>
                          <div>
                            <p className="font-black text-gray-900 leading-none whitespace-nowrap">{record.category}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 whitespace-nowrap">{record.farmer}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex">{renderStatus(record)}</div>
                      </td>
                      <td className="p-6">
                          <p className="text-[11px] font-black text-gray-800 uppercase leading-none whitespace-nowrap">{record.type}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase mt-1 whitespace-nowrap">
                            {record.type === "Milk Production" && `${record.quantity} ${record.unit} (${record.time})`}
                            {record.type === "Slaughter (Katay)" && `Tag: ${record.tag} | ${record.liveWeight}kg`}
                            {record.type === "Live Cattle Sale" && `${record.heads} Heads | ₱${record.price}`}
                            {record.category === "Disease" && record.metric}
                          </p>
                      </td>
                      <td className="p-6">
                        <button 
                          onClick={() => setReviewingReport(record)} 
                          className="bg-[#1A365D] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-blue-800 transition-all whitespace-nowrap"
                        >
                          Process
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* MOBILE ONLY HINT */}
          <div className="lg:hidden mt-4 text-center">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">← Swipe left/right to view table →</p>
          </div>
        </div>
      </main>
      <MobileNavSibat />
    </div>
  );
}