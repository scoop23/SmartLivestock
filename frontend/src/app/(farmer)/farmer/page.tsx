"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from "@/app/components/page-header";
import { Icon } from 'lucide-react';
import { cowHead } from '@lucide/lab';
import {
  AlertTriangle, Package, Bell, Plus,
  Stethoscope, X, Camera, Send, RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FarmerStats from "./farmer-stats";
import FarmerCharts from "./farmer-charts";
import { useFarmerDashboardAnalytics } from "./farmer-analytics";

export default function FarmerDashboard() {
  const router = useRouter();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState('behavior'); // behavior, disease, injury

  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
  } = useFarmerDashboardAnalytics();

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
    <>
      <PageHeader
        title="Welcome, Juan!"
        subtitle="San Roque, Padre Garcia"
        variant="farmer"
        maxWidthClass="max-w-7xl"
        action={
          <Button variant="ghost" size="icon" className="rounded-lg bg-white/10 hover:bg-white/20 text-white" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
        }
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Stats + Charts */}
        {isLoading ? (
          <>
            <FarmerStats isLoading />
            <FarmerCharts isLoading />
          </>
        ) : isError ? (
          <Card className="p-10 text-center border-red-200 bg-red-50">
            <h3 className="font-semibold text-red-700">
              Unable to load dashboard analytics.
            </h3>
            <p className="text-sm text-red-600 mt-2">
              Please try again.
            </p>
            <Button
              className="mt-4"
              onClick={() => refetch()}
            >
              <RefreshCw className="size-4" /> Retry
            </Button>
          </Card>
        ) : (
          <>
            <FarmerStats data={analytics} />
            <FarmerCharts data={analytics} />
          </>
        )}

        {/* Quick Actions */}
        {isLoading ? (
          <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="w-5 h-5 rounded-md" />
                <Skeleton className="h-6 w-32 rounded-lg" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-3 p-5 bg-slate-50 rounded-2xl border-2 border-transparent"
                  >
                    <Skeleton className="size-12 rounded-xl" />
                    <Skeleton className="h-4 w-24 rounded-md" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl overflow-hidden">
            <CardContent className="p-5">
              <h3 className="text-base font-black text-emerald-950 mb-4 flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-100/80 text-emerald-900">
                  <Icon iconNode={cowHead} className="w-4 h-4" />
                </div>
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => router.push('/livestock-inventory')}
                  className="group flex flex-col items-center gap-3 p-5 bg-emerald-50/40 rounded-2xl border-2 border-transparent hover:border-emerald-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="p-3 bg-white rounded-2xl shadow-xs border border-emerald-900/10 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-emerald-800" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-950">Add Livestock</span>
                </button>

                <button
                  onClick={() => router.push('/production-dashboard')}
                  className="group flex flex-col items-center gap-3 p-5 bg-sky-50/40 rounded-2xl border-2 border-transparent hover:border-sky-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="p-3 bg-white rounded-2xl shadow-xs border border-sky-900/10 group-hover:scale-110 transition-transform">
                    <Package className="w-6 h-6 text-sky-800" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-sky-950">Log Production</span>
                </button>

                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="group flex flex-col items-center gap-3 p-5 bg-amber-50/40 rounded-2xl border-2 border-transparent hover:border-amber-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="p-3 bg-white rounded-2xl shadow-xs border border-amber-900/10 group-hover:scale-110 transition-transform">
                    <Stethoscope className="w-6 h-6 text-amber-800" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-950">Report Observation</span>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Health Alerts & Observation Log */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Health Alerts Skeleton */}
            <Card className="border-2 border-stone-200/60 bg-white shadow-xs rounded-3xl">
              <CardContent className="p-5">
                <Skeleton className="h-6 w-32 mb-4 rounded-lg" />
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex gap-3">
                        <Skeleton className="size-5 rounded-full shrink-0 mt-0.5" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-36 rounded-md" />
                          <Skeleton className="h-3 w-5/6 rounded-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Observation Log Skeleton */}
            <Card className="border-2 border-stone-200/60 bg-white shadow-xs rounded-3xl">
              <CardContent className="p-5">
                <Skeleton className="h-6 w-36 mb-4 rounded-lg" />
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="size-2 rounded-full mt-1.5 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-32 rounded-md" />
                        <Skeleton className="h-3 w-48 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2 border-rose-900/10 bg-linear-to-b from-rose-50/20 to-white shadow-xs rounded-3xl overflow-hidden">
              <CardContent className="p-5">
                <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-rose-100 text-rose-800">
                    <AlertTriangle className="size-4" />
                  </div>
                  Health Alerts
                </h3>
                <div className="space-y-3">
                  {recentAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/60 shadow-2xs">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-black text-rose-950">{alert.title}</h4>
                          <p className="text-xs text-rose-900/80 mt-1 font-medium leading-relaxed">{alert.message}</p>
                          <span className="inline-block text-[10px] font-bold text-rose-700/70 mt-2 font-mono">{alert.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-900/10 bg-linear-to-b from-emerald-50/20 to-white shadow-xs rounded-3xl overflow-hidden">
              <CardContent className="p-5">
                <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-900">
                    <Stethoscope className="size-4" />
                  </div>
                  Observation Log
                </h3>
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-white border border-stone-200/70 shadow-2xs flex items-start gap-3">
                    <div className="w-2.5 h-2.5 bg-amber-500 rounded-full mt-1.5 shrink-0 ring-4 ring-amber-100" />
                    <div>
                      <p className="text-xs font-black text-slate-800">Reduced Appetite</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Cattle #B-042 • Reported 4h ago</p>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-stone-200/70 shadow-2xs flex items-start gap-3">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1.5 shrink-0 ring-4 ring-emerald-100" />
                    <div>
                      <p className="text-xs font-black text-slate-800">Normal Rut Behavior</p>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Cattle #B-011 • Reported Yesterday</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* REPORT ISSUE MODAL */}
        {isReportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4">
            <Card className="w-full max-w-lg border-slate-200 shadow-2xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Report Observation</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Quick Health Check</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsReportModalOpen(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Type Selector */}
                  <div className="flex gap-2">
                    {['behavior', 'disease', 'injury'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setReportType(t)}
                        className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${reportType === t ? 'bg-[#2D5A27] text-white shadow-lg shadow-green-900/20' : 'bg-slate-100 text-slate-500'
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cattle-select" className="text-[10px] font-black text-slate-500 uppercase">Which Cattle?</Label>
                      <Select>
                        <SelectTrigger id="cattle-select">
                          <SelectValue placeholder="Select cattle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="B-042">Cattle #B-042</SelectItem>
                          <SelectItem value="B-011">Cattle #B-011</SelectItem>
                          <SelectItem value="A-099">Cattle #A-099</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="desc" className="text-[10px] font-black text-slate-500 uppercase">Describe Observation</Label>
                      <Textarea
                        id="desc"
                        placeholder="e.g. Unusual limping, not eating, or aggressive behavior..."
                        className="min-h-[100px]"
                      />
                    </div>

                    <Button variant="outline" className="w-full gap-2 border-dashed">
                      <Camera className="w-4 h-4" />
                      <span className="text-xs font-bold">Add Photo</span>
                    </Button>
                  </div>

                  <Button
                    onClick={() => {
                      alert("Report sent to Municipal Vet & SIBAT Officer");
                      setIsReportModalOpen(false);
                    }}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-medium shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    Submit Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
