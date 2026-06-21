"use client";

import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import MobileNav from '../components/mobilenav';
import { 
  Megaphone, 
  Calendar, 
  ChevronRight, 
  Newspaper, 
  Info, 
  Search, 
  Bell,
  ArrowLeft
} from 'lucide-react';

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
      thumbnail: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400',
      isPinned: true
    },
    {
      id: 2,
      category: 'Market Update',
      title: 'Livestock Market Prices - April Week 4',
      summary: 'Average live weight price for premium cattle has increased by ₱5/kg. Local auctions showing strong demand for breeding heifers.',
      date: 'April 26, 2026',
      thumbnail: 'https://images.unsplash.com/photo-1543749490-7f6d2bb14ef2?auto=format&fit=crop&q=80&w=400',
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
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {/* Header - Matching Dashboard Theme */}
        <div className="bg-[#2D5A27] text-white p-4 md:p-6 shadow-md">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button 
                    onClick={() => router.back()} 
                    className="p-2 hover:bg-white/10 rounded-full md:hidden"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-2xl mb-1 text-white flex items-center gap-2">
                    <Megaphone className="w-6 h-6 text-yellow-400" />
                    Agri-News
                  </h1>
                  <p className="text-white/90 text-sm">Latest updates for Padre Garcia Farmers</p>
                </div>
              </div>
              <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                <Bell className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Scrollable Row */}
        <div className="bg-white border-b sticky top-0 z-10 overflow-x-auto no-scrollbar">
          <div className="max-w-4xl mx-auto px-4 py-3 flex gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeFilter === filter
                    ? 'bg-[#2D5A27] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* News Feed */}
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          <div className="space-y-6">
            {newsItems
              .filter(item => activeFilter === 'All' || item.category === activeFilter)
              .map((news) => (
                <div 
                  key={news.id} 
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <div className="sm:w-48 h-40 sm:h-auto overflow-hidden relative">
                      <img 
                        src={news.thumbnail} 
                        alt={news.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {news.isPinned && (
                        <div className="absolute top-2 left-2 bg-[#D32F2F] text-white text-[10px] font-bold px-2 py-1 rounded">
                          PINNED
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-[#2D5A27] uppercase tracking-wider">
                          {news.category}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {news.date}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug group-hover:text-[#2D5A27] transition-colors">
                        {news.title}
                      </h3>
                      
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {news.summary}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#2D5A27] flex items-center gap-1">
                          Read Full Details <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Useful Links / Info Box */}
          <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
            <div className="flex gap-3">
              <div className="p-2 bg-blue-100 rounded-lg h-fit">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-sm mb-1">Need verification?</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  For announcements regarding local laws or government support, you can visit the Padre Garcia Municipal Hall during office hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}