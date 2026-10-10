'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardCheck, Map, Megaphone, FileText, QrCode } from 'lucide-react';

export default function MobileNavAuction() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', path: '/auction', icon: LayoutDashboard },
    { label: 'Gate', path: '/auction-gate', icon: QrCode },
    { label: 'Record Transfer', path: '/auction-ownership-transfers', icon: FileText },
    { label: 'Records', path: '/auction-ownership-transfers/registry', icon: ClipboardCheck },
    { label: 'Intake & Logs', path: '/auction-inspections', icon: ClipboardCheck },
    { label: 'Movement GIS', path: '/auction-gis', icon: Map },
    { label: 'Notices', path: '/auction-announcement', icon: Megaphone },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 z-30 shadow-lg">
      <div className="mx-auto grid max-w-3xl grid-cols-7">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = pathname === item.path || (item.path !== '/auction' && item.path !== '/auction-ownership-transfers' && pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => {
                if (item.path !== pathname && pathname === "/auction-inspections/new") {
                  const navigation = new CustomEvent("smartlivestock:guard-navigation", {
                    cancelable: true,
                    detail: { to: item.path },
                  });
                  window.dispatchEvent(navigation);
                  if (navigation.defaultPrevented) return;
                }
                router.push(item.path);
              }}
              className={`flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-[#7C3AED] font-black scale-105'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <IconComponent className={`size-5 ${isActive ? 'text-[#7C3AED]' : 'text-slate-500'}`} />
              <span className="text-[9px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
