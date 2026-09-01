"use client";

import { useState } from "react";
import { Bell, Search, X } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ANNOUNCEMENTS, Announcement } from "./types";
import { AnnouncementCard } from "./announcement-card";

export default function AuctionAnnouncement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const query = searchQuery.toLowerCase().trim();
  const filtered = ANNOUNCEMENTS.filter((item) => {
    const matchesCat = selectedCategory === "ALL" || item.category === selectedCategory;
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query) ||
      item.author.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  return (
    <>
      <PageHeader
        title="Auction Announcements & Bulletins"
        subtitle="Official notices, market schedules, and biosecurity advisories for auction inspectors"
        variant="auction"
        maxWidthClass="max-w-7xl"
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search bulletins and advisories…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", "Policy", "Schedule", "Market", "System"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#7C3AED] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat === "ALL" ? "All Bulletins" : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Announcement Feed */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <Card className="p-12 text-center rounded-2xl border-dashed border-slate-200">
              <div className="flex flex-col items-center space-y-2">
                <Bell className="w-8 h-8 text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">No announcements found</p>
                <p className="text-xs text-slate-400">Try adjusting your search or category filter.</p>
              </div>
            </Card>
          ) : (
            filtered.map((item) => (
              <AnnouncementCard key={item.id} announcement={item} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
