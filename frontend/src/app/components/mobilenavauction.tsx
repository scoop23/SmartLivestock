import React from 'react'
import { useRouter } from 'next/navigation';
import { LayoutDashboard, CheckSquare, Bell } from 'lucide-react';

export default function MobileNavAuction() {
  const router = useRouter();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        <button
          onClick={() => router.push('/auction')}
          className="flex flex-col items-center gap-1 text-[#7C3AED]"
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-xs">Home</span>
        </button>

        <button
          onClick={() => router.push('/auction-inspections')}
          className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#7C3AED]"
        >
          <CheckSquare className="w-6 h-6" />
          <span className="text-xs">Inspections</span>
        </button>

        <button
          onClick={() => router.push('/auction-announcement')}
          className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#7C3AED] relative"
        >
          <Bell className="w-6 h-6" />
          <span className="text-xs">Announcements</span>
        </button>
      </div>
    </nav>
  )
}
