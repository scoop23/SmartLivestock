"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MobileNav from "@/app/components/mobilenav";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import { Icon } from 'lucide-react';
import { cowHead } from '@lucide/lab';
import {
  Sprout, TrendingUp, AlertTriangle, Package, Bell, Plus,
  Stethoscope, MessageSquare, X, Camera, Send
} from 'lucide-react';

export default function FarmerDashboard() {
  const router = useRouter();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState('behavior'); // behavior, disease, injury

  const myStats = [
    {
      label: 'My Cattle',
      value: '24',
      icon: <Icon iconNode={cowHead} className="w-5 h-5" />,
      color: 'bg-[#2D5A27]',
    },
    {
      label: 'Avg. Meat (Katay)',
      value: '122 kg',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-blue-600',
    },
    {
      label: 'Active Alerts',
      value: '1',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'bg-[#D32F2F]',
    },
    {
      label: 'This Month Sales',
      value: '₱45,600',
      icon: <Package className="w-5 h-5" />,
      color: 'bg-green-600',
    },
  ];
  const recentAlerts = [
    {
      id: 1,
      type: 'warning',
      title: 'Vaccination Due',
      message: 'Annual vaccination scheduled for 5 cattle on April 30, 2026',
      date: '2 days ago',
    }
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <PageHeader
          title="Welcome, Juan!"
          subtitle="San Roque, Padre Garcia"
          variant="farmer"
          maxWidthClass="max-w-4xl"
          mobileMenuOffset={false}
          action={
            <button className="rounded-xl bg-white/10 p-2 transition-all hover:bg-white/20" aria-label="Notifications">
              <Bell className="h-6 w-6" />
            </button>
          }
        />

        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {myStats.map((stat) => {
              return (
                <div key={stat.label} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className={`${stat.color} text-white p-2.5 rounded-xl inline-block mb-3`}>
                    {stat.icon}
                  </div>
                  <p className="text-2xl font-black text-gray-800">{stat.value}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Actions - Enhanced with Health Report */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-8">
            <h3 className="mb-5 font-bold text-gray-800 flex items-center gap-2">
              <Icon iconNode={cowHead} className="w-5 h-5 text=[#2D5A27]" />
              Farm Management
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/livestock-inventory')}
                className="group flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl border border-transparent hover:border-[#2D5A27] hover:bg-white hover:shadow-xl transition-all"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-[#2D5A27]" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-gray-600">Add Cattle</span>
              </button>

              <button
                onClick={() => router.push('/production-logger')}
                className="group flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl border border-transparent hover:border-[#2D5A27] hover:bg-white hover:shadow-xl transition-all"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6 text-[#2D5A27]" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-gray-600"> Log Meat </span>
              </button>

              {/* NEW: Health Report Button */}
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="group flex flex-col items-center gap-3 p-5 bg-orange-50 rounded-2xl border border-transparent hover:border-orange-500 hover:bg-white hover:shadow-xl transition-all"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                  <Stethoscope className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-orange-700">Report Issue</span>
              </button>
            </div>
          </div>

          {/* Health Alerts & Behavior Log */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <h3 className="mb-4 font-bold text-gray-800">Health Alerts</h3>
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 rounded-2xl bg-orange-50 border border-orange-100">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-orange-900">{alert.title}</h4>
                        <p className="text-xs text-orange-800/80 mt-1">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <h3 className="mb-4 font-bold text-gray-800">Observation Log</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                  <div>
                    <p className="font-bold text-gray-800">Reduced Appetite</p>
                    <p className="text-xs text-gray-500">Cattle #B-042 • Reported 4h ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                  <div>
                    <p className="font-bold text-gray-800">Normal Rut Behavior</p>
                    <p className="text-xs text-gray-500">Cattle #B-011 • Reported Yesterday</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* REPORT ISSUE MODAL */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-gray-900">Report Observation</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Quick Health Check</p>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Type Selector */}
              <div className="flex gap-2">
                {['behavior', 'disease', 'injury'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setReportType(t)}
                    className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${reportType === t ? 'bg-[#2D5A27] text-white shadow-lg shadow-green-900/20' : 'bg-gray-100 text-gray-400'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Which Cattle?</label>
                  <select className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#2D5A27]">
                    <option>Cattle #B-042</option>
                    <option>Cattle #B-011</option>
                    <option>Cattle #A-099</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Describe Observation</label>
                  <textarea
                    placeholder="e.g. Unusual limping, not eating, or aggressive behavior..."
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-[#2D5A27] min-h-[100px]"
                  />
                </div>

                <div className="flex gap-4">
                  <button className="flex-1 flex items-center justify-center gap-2 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors">
                    <Camera className="w-5 h-5" />
                    <span className="text-xs font-bold">Add Photo</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  alert("Report sent to Municipal Vet & SIBAT Officer");
                  setIsReportModalOpen(false);
                }}
                className="w-full py-5 bg-[#2D5A27] text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-green-900/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Send className="w-4 h-4" />
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}
