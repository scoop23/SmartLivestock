"use client";

import React, { useState } from "react";
import {
  Megaphone, Calendar, Pin, ChevronRight,
  Info, Newspaper, FileText, Image as ImageIcon
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card } from "@/components/ui/card";

export default function SibatAnnouncementsPage() {
  const [filter, setFilter] = useState<"all" | "memo" | "event" | "news">("all");

  const announcements = [
    {
      id: "ANN-2026-001",
      category: "memo",
      isPinned: true,
      title: "Quarterly Livestock Inventory Deadline",
      date: "April 28, 2026",
      summary: "All SIBAT officers must submit their final validated production counts for April by Friday. Please ensure all 'Flagged' records are cleared.",
      author: "Admin Office",
      tagColor: "bg-blue-100 text-blue-700 border-blue-200",
      thumbnail: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?q=80&w=800&auto=format&fit=crop"
    },
    {
      id: "ANN-2026-002",
      category: "event",
      isPinned: false,
      title: "Barangay Lipay Vaccination Drive",
      date: "May 05, 2026",
      summary: "Free hemorrhagic septicemia vaccinations for cattle and carabaos at the Purok 1 Multi-purpose Hall starting at 8:00 AM.",
      author: "Municipal Vet Office",
      tagColor: "bg-purple-100 text-purple-700 border-purple-200",
      thumbnail: "https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=800&auto=format&fit=crop"
    },
    {
      id: "ANN-2026-003",
      category: "news",
      isPinned: false,
      title: "Lipay Cooperative Wins Best Dairy Producer",
      date: "April 15, 2026",
      summary: "Congratulations to our local dairy group for achieving the highest milk quality rating in the province this month!",
      author: "Local News",
      tagColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
      thumbnail: "https://images.unsplash.com/photo-1527159347948-59af1feee74c?q=80&w=800&auto=format&fit=crop"
    },
    {
      id: "ANN-2026-004",
      category: "memo",
      isPinned: false,
      title: "New Biosecurity Guidelines for Swine",
      date: "April 20, 2026",
      summary: "Updated protocols for entering backyard pens. Please review the attached document for the new sanitation steps.",
      author: "MAO Director",
      tagColor: "bg-blue-100 text-blue-700 border-blue-200",
      thumbnail: "https://images.unsplash.com/photo-1516467508483-a7212febe31a?q=80&w=800&auto=format&fit=crop"
    }
  ];

  const filteredData = filter === "all" ? announcements : announcements.filter(a => a.category === filter);

  const filterButtons = [
    { id: "all" as const, label: "Everything", icon: <Newspaper size={14} /> },
    { id: "memo" as const, label: "Memos", icon: <FileText size={14} /> },
    { id: "event" as const, label: "Events", icon: <Calendar size={14} /> },
    { id: "news" as const, label: "News", icon: <ImageIcon size={14} /> },
  ];

  return (
    <>
      <PageHeader
        title="Bulletin Board"
        subtitle="Barangay Updates & Announcements"
        icon={
          <span className="flex rounded-lg bg-amber-400 p-2 shadow-inner">
            <Megaphone className="h-5 w-5 -rotate-12 text-blue-900" />
          </span>
        }
        variant="sibat"
        maxWidthClass="max-w-7xl"
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Filter Feed</h3>
            <div className="space-y-2">
              {filterButtons.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilter(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase transition-all ${filter === cat.id
                    ? "bg-[#1A365D] text-white shadow-lg shadow-blue-900/20"
                    : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </Card>

          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
            <h3 className="text-[10px] font-black text-blue-900 uppercase flex items-center gap-2 mb-2">
              <Info size={14} /> Help Desk
            </h3>
            <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
              Can&apos;t see a specific memo? Contact the Municipal Admin for permissions.
            </p>
          </div>
        </div>

        {/* Announcement Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredData.length === 0 ? (
            <Card className="md:col-span-2 py-12 border-dashed border-slate-200 rounded-2xl">
              <div className="flex flex-col items-center text-center space-y-3 px-6">
                <div className="p-3 rounded-2xl bg-slate-100">
                  <Newspaper className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">No announcements found</p>
                <p className="text-xs text-slate-500">Try selecting a different category.</p>
              </div>
            </Card>
          ) : (
            filteredData.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="relative h-48 w-full bg-slate-200 overflow-hidden">
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm border ${item.tagColor}`}>
                      {item.category}
                    </span>
                  </div>
                  {item.isPinned && (
                    <div className="absolute top-4 right-4 bg-amber-400 text-amber-900 p-2 rounded-full shadow-lg">
                      <Pin size={14} className="fill-amber-900" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">
                    <Calendar size={12} /> {item.date}
                  </div>

                  <h2 className="text-lg font-black text-slate-900 mb-3 leading-tight group-hover:text-blue-800 transition-colors">
                    {item.title}
                  </h2>

                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-6">
                    {item.summary}
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">By: {item.author}</p>
                    <button className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 group-hover:gap-2 transition-all">
                      View Post <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}