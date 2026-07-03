"use client";

import React, { useState } from "react";
import { 
  Bell, ShieldAlert, CheckCircle2, 
  Search, Clock, ArrowRight, Activity, 
  ShieldCheck, MapPin, Send
} from "lucide-react";

import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import MobileNavSibat from "@/app/components/mobilenavsibat";

export default function SibatAlertsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");

  const [alerts, setAlerts] = useState([
    {
      id: "REP-991",
      farmer: "Juan Dela Cruz",
      title: "Swine Health Issue",
      location: "Purok 4, Banaba",
      time: "10 mins ago",
      status: "pending",
      description: "Farmer reports 2 pigs with high fever and skin spots. Needs verification."
    },
    {
      id: "REP-992",
      farmer: "Maria Santos",
      title: "Cattle Limping",
      location: "Purok 1, Poblacion",
      time: "45 mins ago",
      status: "pending",
      description: "Brahman bull showing signs of foot injury. Farmer unsure if disease or accident."
    }
  ]);

  const handleValidation = (id: string, decision: "confirmed" | "false_alarm") => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, status: decision } : alert
    ));
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans mb-15">
      <div className="flex">
        <div className="hidden md:block"><Sidebar role="sibat" onLogout={() => router.push('/')} /></div>
        
        <div className="flex flex-col w-full"> 
          <PageHeader
            title="Health Report Alerts"
            subtitle="Verify and Forward to MAO"
            icon={<Bell className="h-6 w-6 text-amber-400" />}
            variant="sibat"
            maxWidthClass="max-w-5xl"
            mobileMenuOffset={false}
          />

          <main className="p-4 lg:p-8 max-w-4xl mx-auto w-full">
            
            {/* TABS */}
            <div className="flex gap-6 mb-6 border-b">
              <button 
                onClick={() => setActiveTab("pending")} 
                className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
              >
                New Reports
              </button>
              <button 
                onClick={() => setActiveTab("resolved")} 
                className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'resolved' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
              >
                Verified History
              </button>
            </div>

            <div className="space-y-4">
              {alerts.filter(a => activeTab === 'pending' ? a.status === 'pending' : a.status !== 'pending').map((alert) => (
                <div key={alert.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-1">{alert.id} • {alert.farmer}</p>
                        <h3 className="text-lg font-black text-slate-900">{alert.title}</h3>
                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                          <MapPin size={12}/> {alert.location} • <Clock size={12}/> {alert.time}
                        </p>
                      </div>
                      
                      {alert.status !== 'pending' && (
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${alert.status === 'confirmed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {alert.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-slate-200 mb-6">
                      <p className="text-sm text-slate-600 italic">{"{alert.description}"}</p>
                    </div>

                    {alert.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleValidation(alert.id, 'confirmed')}
                          className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black text-[10px] uppercase hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                        >
                          <ShieldAlert size={14}/> Confirmed Case
                        </button>
                        <button 
                          onClick={() => handleValidation(alert.id, 'false_alarm')}
                          className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-[10px] uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                        >
                          <ShieldCheck size={14}/> False Alarm
                        </button>
                      </div>
                    ) : (
                      <button className="w-full bg-[#1A365D] text-white py-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-blue-800">
                        <Send size={14}/> Forward Verified Data to MAO
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {alerts.filter(a => activeTab === 'pending' ? a.status === 'pending' : a.status !== 'pending').length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                  <CheckCircle2 className="mx-auto text-slate-300 mb-2" size={40} />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No reports to validate</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      <MobileNavSibat />
    </div>
  );
}