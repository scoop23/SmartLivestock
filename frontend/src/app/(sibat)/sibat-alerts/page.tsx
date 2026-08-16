"use client";

import React, { useState } from "react";
import {
  Bell, ShieldAlert, CheckCircle2,
  Clock, MapPin, Send,
  ShieldCheck, Search, X, RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/* ── Tab config ── */
type TabKey = "pending" | "resolved";
const TAB_PILLS: { value: TabKey; label: string }[] = [
  { value: "pending", label: "New Reports" },
  { value: "resolved", label: "Verified History" },
];

export default function SibatAlertsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [searchQuery, setSearchQuery] = useState("");

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

  const query = searchQuery.toLowerCase().trim();
  const tabFiltered = alerts.filter(a =>
    activeTab === "pending" ? a.status === "pending" : a.status !== "pending"
  );
  const filtered = tabFiltered.filter(a =>
    !query ||
    a.farmer.toLowerCase().includes(query) ||
    a.title.toLowerCase().includes(query) ||
    a.id.toLowerCase().includes(query)
  );

  const pendingCount = alerts.filter(a => a.status === "pending").length;
  const resolvedCount = alerts.filter(a => a.status !== "pending").length;

  return (
    <>
      <PageHeader
        title="Health Report Alerts"
        subtitle="Verify and Forward to MAO"
        icon={<Bell className="h-5 w-5 text-amber-400" />}
        variant="sibat"
        maxWidthClass="max-w-6xl"
      />

      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search farmer, alert title, ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm focus-visible:ring-blue-500/30"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <Button
                variant="outline" size="sm"
                onClick={() => setSearchQuery("")}
                className="rounded-xl text-xs font-bold gap-1.5 h-10 shrink-0"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>

          <Separator className="opacity-60" />

          {/* Tab pills */}
          <div className="px-3 py-2.5 flex items-center gap-1.5">
            {TAB_PILLS.map((tab) => {
              const isActive = activeTab === tab.value;
              const count = tab.value === "pending" ? pendingCount : resolvedCount;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                    border transition-all duration-200 active:scale-95
                    ${isActive
                      ? "bg-[#1A365D] text-white border-[#1A365D] shadow-md shadow-blue-900/15"
                      : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-700"
                    }
                  `}
                >
                  {tab.label}
                  <span className={`text-[10px] font-extrabold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full leading-none ${isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div className="px-1">
          <p className="text-xs font-semibold text-slate-500">
            Showing <span className="text-slate-900 font-extrabold tabular-nums">{filtered.length}</span> alert{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Alert Cards */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card className="py-12 border-dashed border-slate-200 rounded-2xl">
              <div className="flex flex-col items-center text-center space-y-3 px-6">
                <div className="p-3 rounded-2xl bg-slate-100">
                  <CheckCircle2 className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">
                  {activeTab === "pending" ? "No new reports to validate" : "No verified reports yet"}
                </p>
                <p className="text-xs text-slate-500 max-w-xs">
                  {activeTab === "pending" ? "All health alerts have been processed." : "Process pending reports to build your history."}
                </p>
              </div>
            </Card>
          ) : (
            filtered.map((alert) => (
              <Card key={alert.id} className="border-2 border-slate-200 bg-white hover:bg-blue-50/30 shadow-xs hover:shadow-sm rounded-2xl transition-all duration-200 overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold text-blue-600 tabular-nums">{alert.id}</span>
                        <span className="text-[10px] font-bold text-slate-400">•</span>
                        <span className="text-xs font-bold text-slate-600">{alert.farmer}</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">{alert.title}</h3>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {alert.location}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {alert.time}</span>
                      </div>
                    </div>

                    {alert.status !== "pending" && (
                      <Badge className={`font-bold text-[10px] uppercase shrink-0 ${alert.status === "confirmed"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                        }`}>
                        {alert.status === "confirmed" ? <><ShieldAlert className="w-3 h-3 mr-1" />Confirmed</> : <><ShieldCheck className="w-3 h-3 mr-1" />False Alarm</>}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-slate-200">
                    <p className="text-sm text-slate-600 italic">&quot;{alert.description}&quot;</p>
                  </div>

                  {/* Actions */}
                  {alert.status === "pending" ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleValidation(alert.id, "confirmed")}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 font-black text-[10px] uppercase gap-2"
                      >
                        <ShieldAlert className="w-4 h-4" /> Confirmed Case
                      </Button>
                      <Button
                        onClick={() => handleValidation(alert.id, "false_alarm")}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-700 text-white rounded-xl h-11 font-black text-[10px] uppercase gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" /> False Alarm
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full bg-[#1A365D] hover:bg-blue-900 text-white rounded-xl h-11 font-black text-xs uppercase gap-2">
                      <Send className="w-4 h-4" /> Forward Verified Data to MAO
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}