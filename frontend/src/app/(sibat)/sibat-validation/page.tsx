"use client";

import React, { useState } from "react";
import {
  ShieldAlert, ShieldCheck, ChevronLeft,
  MessageSquare, Send, Activity, Milk, Beef, Scale,
  CheckCircle2, AlertCircle, ClipboardCheck,
  Clock, Tag, DollarSign, Search, SlidersHorizontal,
  X, RotateCcw, Eye,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/* ── Status chip config ── */
type StatusKey = "all" | "pending" | "verified" | "flagged" | "confirmed" | "false_alarm";
const STATUS_CHIPS: { value: StatusKey; label: string; activeClass: string; dotClass: string }[] = [
  { value: "all", label: "All", activeClass: "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20", dotClass: "bg-slate-400" },
  { value: "pending", label: "Pending", activeClass: "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25", dotClass: "bg-amber-500" },
  { value: "verified", label: "Verified", activeClass: "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25", dotClass: "bg-blue-500" },
  { value: "confirmed", label: "Confirmed", activeClass: "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/25", dotClass: "bg-red-500" },
  { value: "flagged", label: "Flagged", activeClass: "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25", dotClass: "bg-orange-500" },
  { value: "false_alarm", label: "False Alarm", activeClass: "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25", dotClass: "bg-emerald-500" },
];

/* ── Category icon map ── */
const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
  "Milk Production": { icon: <Milk className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50", border: "border-blue-200/60" },
  "Slaughter (Katay)": { icon: <Beef className="w-5 h-5 text-orange-600" />, bg: "bg-orange-50", border: "border-orange-200/60" },
  "Live Cattle Sale": { icon: <Scale className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50", border: "border-emerald-200/60" },
  "Health Report": { icon: <Activity className="w-5 h-5 text-red-500" />, bg: "bg-red-50", border: "border-red-200/60" },
};

const renderStatusBadge = (record: any) => {
  if (record.category === "Disease") {
    if (record.status === "confirmed") return <Badge className="bg-red-100 text-red-800 border-red-200 font-bold text-[10px] uppercase flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Confirmed</Badge>;
    if (record.status === "false_alarm") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[10px] uppercase flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> False Alarm</Badge>;
  } else {
    if (record.status === "verified") return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-[10px] uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</Badge>;
    if (record.status === "flagged") return <Badge className="bg-orange-100 text-orange-800 border-orange-200 font-bold text-[10px] uppercase flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Flagged</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-[10px] uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
};

export default function SibatValidationPortal() {
  const [reviewingReport, setReviewingReport] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [pendingRecords, setPendingRecords] = useState([
    {
      id: "MLK-001", farmer: "Maria Santos", category: "Production",
      type: "Milk Production", detail: "Holstein Herd", quantity: "45",
      unit: "Liters", time: "Morning", date: "2026-04-26",
      location: "Purok 1, Lipay",
      description: "Standard morning yield from 5 cows.",
      status: "pending", icon: <Milk className="text-blue-500" />
    },
    {
      id: "SLG-002", farmer: "Ricardo Gomez", category: "Production",
      type: "Slaughter (Katay)", tag: "TAG-9921", liveWeight: "420",
      dressedWeight: "280", date: "2026-04-26",
      location: "Purok 2, Lipay",
      description: "Emergency slaughter due to leg injury (Non-disease).",
      status: "pending", icon: <Beef className="text-orange-600" />
    },
    {
      id: "SAL-003", farmer: "Elena Vilia", category: "Production",
      type: "Live Cattle Sale", heads: "2", totalKg: "850",
      price: "145,000", date: "2026-04-25",
      location: "Purok 5, Lipay",
      description: "Sold to buyer from Batangas City.",
      status: "pending", icon: <Scale className="text-emerald-600" />
    },
    {
      id: "DIS-004", farmer: "Juan Dela Cruz", category: "Disease",
      type: "Health Report", detail: "Brahman Bull", metric: "1 Head",
      location: "Purok 4, Lipay",
      description: "High fever and salivation observed. Possible FMD.",
      status: "pending", icon: <Activity className="text-red-500" />
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

  /* Summary line for each record type */
  const getSummary = (record: any) => {
    switch (record.type) {
      case "Milk Production": return `${record.quantity} ${record.unit} (${record.time})`;
      case "Slaughter (Katay)": return `Tag: ${record.tag} • ${record.liveWeight}kg live → ${record.dressedWeight}kg dressed`;
      case "Live Cattle Sale": return `${record.heads} heads • ${record.totalKg}kg • ₱${record.price}`;
      case "Health Report": return `${record.detail} • ${record.metric}`;
      default: return "";
    }
  };

  /* Filter pipeline */
  const query = searchQuery.toLowerCase().trim();
  const filtered = pendingRecords.filter((record) => {
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    const matchesSearch =
      !query ||
      record.farmer.toLowerCase().includes(query) ||
      record.type.toLowerCase().includes(query) ||
      record.id.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const statusCounts: Record<string, number> = { all: pendingRecords.length };
  pendingRecords.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1; });

  const activeFilterCount = [statusFilter !== "all", query.length > 0].filter(Boolean).length;

  // ══════════════════════════════════════
  // DETAIL REVIEW VIEW
  // ══════════════════════════════════════
  if (reviewingReport) {
    const isDisease = reviewingReport.category === "Disease";
    const type = reviewingReport.type;

    return (
      <>
        <PageHeader
          title="Process Submission"
          variant="sibat"
          maxWidthClass="max-w-7xl"
          icon={
            <button onClick={() => setReviewingReport(null)} className="rounded-full p-2 transition-colors hover:bg-white/10" aria-label="Back to submissions">
              <ChevronLeft />
            </button>
          }
        />

        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-2xl border border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex gap-4 mb-6 border-b pb-4">
                    <div className="w-12 h-12 bg-slate-50 border rounded-xl flex items-center justify-center text-2xl shrink-0">{reviewingReport.icon}</div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 leading-tight">{reviewingReport.type}</h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{reviewingReport.farmer} • {reviewingReport.location}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {type === "Milk Production" && (
                      <>
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-[10px] font-black text-blue-400 uppercase">Quantity</p>
                          <p className="font-black text-blue-900 text-lg">{reviewingReport.quantity} L</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-[10px] font-black text-blue-400 uppercase">Time</p>
                          <p className="font-black text-blue-900 flex items-center gap-1"><Clock size={14} /> {reviewingReport.time}</p>
                        </div>
                      </>
                    )}
                    {type === "Slaughter (Katay)" && (
                      <>
                        <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                          <p className="text-[10px] font-black text-orange-400 uppercase">Tag #</p>
                          <p className="font-black text-orange-900 flex items-center gap-1"><Tag size={14} /> {reviewingReport.tag}</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                          <p className="text-[10px] font-black text-orange-400 uppercase">Live Weight</p>
                          <p className="font-black text-orange-900">{reviewingReport.liveWeight} kg</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                          <p className="text-[10px] font-black text-orange-400 uppercase">Dressed</p>
                          <p className="font-black text-orange-900">{reviewingReport.dressedWeight} kg</p>
                        </div>
                      </>
                    )}
                    {type === "Live Cattle Sale" && (
                      <>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-400 uppercase">Heads</p>
                          <p className="font-black text-emerald-900">{reviewingReport.heads}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-400 uppercase">Total Weight</p>
                          <p className="font-black text-emerald-900">{reviewingReport.totalKg} kg</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-400 uppercase">Price</p>
                          <p className="font-black text-emerald-900 flex items-center gap-1"><DollarSign size={14} /> {reviewingReport.price}</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-6 p-4 bg-slate-50 border rounded-xl text-sm italic text-slate-600">
                    <p className="text-[10px] font-black text-slate-400 uppercase not-italic mb-1 tracking-widest">Farmer&apos;s Note</p>
                    &quot;{reviewingReport.description}&quot;
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2"><MessageSquare size={14} /> Validation Audit Notes</h3>
                  <textarea className="w-full p-4 bg-slate-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600" rows={3} placeholder="Confirm weights, health status, or price details..." />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="rounded-2xl border border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><ClipboardCheck size={14} /> Decision</h3>
                  <div className="space-y-3">
                    {isDisease ? (
                      <>
                        <button onClick={() => handleValidationAction('confirmed')} className="w-full flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50 text-red-700 font-black text-[11px] uppercase hover:bg-red-100 transition-all">Confirmed Case <ShieldAlert size={18} /></button>
                        <button onClick={() => handleValidationAction('false_alarm')} className="w-full flex items-center justify-between p-4 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 font-black text-[11px] uppercase hover:bg-emerald-100 transition-all">False Alarm <ShieldCheck size={18} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleValidationAction('verified')} className="w-full flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 font-black text-[11px] uppercase hover:bg-blue-100 transition-all">Approve Entry <CheckCircle2 size={18} /></button>
                        <button onClick={() => handleValidationAction('flagged')} className="w-full flex items-center justify-between p-4 rounded-xl border border-orange-100 bg-orange-50 text-orange-700 font-black text-[11px] uppercase hover:bg-orange-100 transition-all">Flag for Review <AlertCircle size={18} /></button>
                      </>
                    )}
                    <button onClick={() => handleValidationAction('forwarded')} className="w-full bg-[#1A365D] text-white py-4 mt-6 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20">Forward to MAO <Send size={16} /></button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ══════════════════════════════════════
  // MAIN LIST VIEW
  // ══════════════════════════════════════
  return (
    <>
      <PageHeader
        title="Data Validation"
        subtitle="Production & Health Queue"
        variant="sibat"
        maxWidthClass="max-w-7xl"
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search farmer, ID, type…"
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
            {activeFilterCount > 0 && (
              <Button
                variant="outline" size="sm"
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                className="rounded-xl text-xs font-bold gap-1.5 h-10 shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </Button>
            )}
          </div>

          <Separator className="opacity-60" />

          <div className="px-3 py-2.5 flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0 hidden sm:block" />
            {STATUS_CHIPS.map((chip) => {
              const isActive = statusFilter === chip.value;
              const count = statusCounts[chip.value] ?? 0;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setStatusFilter(chip.value)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                    border transition-all duration-200 active:scale-95
                    ${isActive ? chip.activeClass : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}
                  `}
                >
                  {!isActive && <span className={`w-1.5 h-1.5 rounded-full ${chip.dotClass}`} />}
                  {chip.label}
                  <span className={`text-[10px] font-extrabold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full leading-none ${isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-slate-500">
            Showing <span className="text-slate-900 font-extrabold tabular-nums">{filtered.length}</span> of <span className="text-slate-900 font-extrabold tabular-nums">{pendingRecords.length}</span> submissions
          </p>
        </div>

        {/* Record Cards */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="py-12 border-dashed border-slate-200 rounded-2xl">
              <div className="flex flex-col items-center text-center space-y-3 px-6">
                <div className="p-3 rounded-2xl bg-slate-100"><Search className="w-6 h-6 text-slate-400" /></div>
                <p className="text-sm font-bold text-slate-700">No submissions found</p>
                <p className="text-xs text-slate-500 max-w-xs">Try adjusting your filters.</p>
              </div>
            </Card>
          ) : (
            filtered.map((record) => {
              const catStyle = CATEGORY_ICONS[record.type] ?? { icon: <ClipboardCheck className="w-5 h-5 text-slate-500" />, bg: "bg-slate-50", border: "border-slate-200" };
              return (
                <Card
                  key={record.id}
                  className={`relative overflow-hidden border-2 ${catStyle.border} ${catStyle.bg}/20 hover:${catStyle.bg}/40 shadow-xs hover:shadow-sm rounded-2xl transition-all duration-200`}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 ${catStyle.bg} border rounded-xl flex items-center justify-center shadow-sm shrink-0`}>
                      {catStyle.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold text-slate-400 tabular-nums">{record.id}</span>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">{record.farmer}</h3>
                        {renderStatusBadge(record)}
                      </div>
                      <p className="text-xs font-bold text-slate-800 uppercase">{record.type}</p>
                      <p className="text-xs font-semibold text-slate-500">{getSummary(record)}</p>
                    </div>

                    {/* Action */}
                    <Button
                      size="sm"
                      onClick={() => setReviewingReport(record)}
                      className="rounded-xl h-9 px-4 text-xs font-bold bg-[#1A365D] hover:bg-[#152944] text-white gap-1.5 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Process
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}