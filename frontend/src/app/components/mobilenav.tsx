import React from 'react'
import { useRouter } from 'next/navigation'; // Changed from 'react-router'
import { Sidebar } from '../components/sidebar';
import { Sprout, TrendingUp, AlertTriangle, Package, Bell, Plus } from 'lucide-react';

export default function MobileNav() {
  const router = useRouter();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button
            onClick={() => router.push('/farmer')}
            className="flex flex-col items-center gap-1 text-[#2D5A27]"
          >
            <Sprout className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          
          <button
            onClick={() => router.push('/livestock-inventory')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27]"
          >
            <Package className="w-6 h-6" />
            <span className="text-xs">Inventory</span>
          </button>
          
          <button
            onClick={() => router.push('/production-logger')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27]"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs">Logger</span>
          </button>
          
          <button
            onClick={() => router.push('/alerts')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27] relative"
          >
            <Bell className="w-6 h-6" />
            <span className="text-xs">Alerts</span>
            <span className="absolute top-0 right-2 w-2 h-2 bg-[#D32F2F] rounded-full"></span>
          </button>
          <button
            onClick={() => router.push('/gis-user-map')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27] relative"
          >
            <span className="text-xs">GIS</span>
          </button>
          <button
            onClick={() => router.push('/farmer-announcement')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27] relative"
          >
            <span className="text-xs">Announcement</span>
          </button>
          <button
            onClick={() => router.push('/farmer-scheduling')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27] relative"
          >
            <span className="text-xs">Scheduling</span>
          </button>
        </div>
      </nav>
  )
}
