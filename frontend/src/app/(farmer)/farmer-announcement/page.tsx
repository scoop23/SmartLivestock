"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { PageHeader } from "@/app/components/page-header";
import {
  Megaphone,
  Calendar,
  ChevronRight,
  Info,
  Bell
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function FarmerNewsPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');

  const newsItems = [
    {
      id: 1,
      category: 'Announcement',
      title: 'Free Vaccination Program in San Roque',
      summary: 'The Municipal Agriculture Office (MAO) will be conducting free Hemorrhagic Septicemia vaccinations for cattle and carabaos this Friday.',
      date: 'April 28, 2026',
      // thumbnail: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400',
      thumbnail: 'https://cdn.sanity.io/images/0vv8moc6/dvm360/509ce66a05c4fa080efebafff0b5c828cb1ebf16-5606x3734.jpg/AdobeStock_684844923.jpeg?w=5606&max-h=3734&fit=crop&auto=format',
      isPinned: true
    },
    {
      id: 2,
      category: 'Market Update',
      title: 'Livestock Market Prices - April Week 4',
      summary: 'Average live weight price for premium cattle has increased by ₱5/kg. Local auctions showing strong demand for breeding heifers.',
      date: 'April 26, 2026',
      // thumbnail: 'https://images.unsplash.com/photo-1543749490-7f6d2bb14ef2?auto=format&fit=crop&q=80&w=400',
      thumbnail: 'https://i0.wp.com/www.marketmanila.com/wp-content/uploads/2009/10/143.jpg?resize=400%2C300&ssl=1',
      isPinned: false
    },
    {
      id: 3,
      category: 'Tips',
      title: 'Preparing for the Dry Season (El Niño)',
      summary: 'Expert tips on managing water consumption and alternative forage storage to keep your herd healthy during the upcoming dry months.',
      date: 'April 24, 2026',
      thumbnail: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&q=80&w=400',
      isPinned: false
    }
  ];

  const filters = ['All', 'Announcement', 'Market Update', 'Tips'];

  return (
    <>
      <PageHeader
        title="Agri-News"
        subtitle="Latest updates for Padre Garcia Farmers"
        icon={<Megaphone className="h-6 w-6 text-yellow-400" />}
        variant="farmer"
        maxWidthClass="max-w-5xl"
        mobileMenuOffset={false}
        action={
          <Button variant="ghost" size="icon" className="rounded-lg bg-white/10 hover:bg-white/20 text-white" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
        }
      />

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm mx-4 md:mx-8 max-w-5xl">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? 'bg-[#2D5A27] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* News Feed */}
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        {newsItems
          .filter(item => activeFilter === 'All' || item.category === activeFilter)
          .map((news) => (
            <Card key={news.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                <div className="sm:w-48 h-40 sm:h-auto overflow-hidden relative">
                  <img
                    src={news.thumbnail}
                    alt={news.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {news.isPinned && (
                    <Badge className="absolute top-2 left-2 bg-rose-600 hover:bg-rose-600 text-white border-0">
                      PINNED
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <CardContent className="flex-1 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-[#2D5A27] uppercase tracking-wider">
                      {news.category}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {news.date}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug hover:text-[#2D5A27] transition-colors">
                    {news.title}
                  </h3>

                  <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                    {news.summary}
                  </p>

                  <span className="text-xs font-semibold text-[#2D5A27] flex items-center gap-1">
                    Read Full Details <ChevronRight className="w-4 h-4" />
                  </span>
                </CardContent>
              </div>
            </Card>
          ))}

        {/* Info Box */}
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardContent className="p-5 flex gap-3">
            <div className="p-2 bg-blue-100 rounded-lg h-fit shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-bold text-blue-900 text-sm mb-1">Need verification?</h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                For announcements regarding local laws or government support, you can visit the Padre Garcia Municipal Hall during office hours.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
