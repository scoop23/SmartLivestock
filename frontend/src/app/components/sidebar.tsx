'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Map,
  Sprout,
  LogOut,
  Menu,
  Database,
  ShieldCheck,
  FileText,
  Upload,
  Newspaper,
  CalendarDays,
  ClipboardCheck,
  Bell,
  Activity,
  Megaphone,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/components/ui/utils';
import { cowHead } from '@lucide/lab';
import { Icon } from 'lucide-react';

interface SidebarProps {
  role: 'farmer' | 'lgu' | 'sibat' | 'auction';
  onLogout: () => void;
}

const adminLinks = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/data-overview', label: 'System Data', icon: Database },
  { path: '/user-management', label: 'User Management', icon: Users },
  { path: '/data-validation', label: 'Data Validation', icon: ShieldCheck },
  { path: '/gis-map', label: 'GIS Map', icon: Map },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/data-uploads', label: 'Data Upload', icon: Upload },
  { path: '/news-announcements', label: 'News And Announcements', icon: Newspaper },
  { path: '/schedules', label: 'Schedules from Farmers', icon: CalendarDays },
];

const farmerLinks = [
  { path: '/farmer', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/livestock-inventory', label: 'Livestock Inventory', icon: Sprout },
  { path: '/production-logger', label: 'Production Logger', icon: ClipboardCheck },
  { path: '/gis-user-map', label: 'GIS User Map', icon: Map },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/farmer-announcement', label: 'News & Announcements', icon: Megaphone },
  { path: '/farmer-scheduling', label: 'Scheduling', icon: CalendarDays },
];

const sibatLinks = [
  { path: '/sibat', label: 'Home', icon: LayoutDashboard },
  { path: '/sibat-validation', label: 'Validation', icon: ShieldCheck },
  { path: '/sibat-monitoring', label: 'Monitoring', icon: Activity },
  { path: '/sibat-alerts', label: 'Alerts', icon: Bell },
  { path: '/sibat-announcement', label: 'Announcement', icon: Megaphone },
];

const auctionLinks = [
  { path: '/auction', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/auction-inspections', label: 'Inspections', icon: ClipboardCheck },
  { path: '/auction-announcement', label: 'Announcements', icon: Newspaper },
];

function getLinks(role: SidebarProps['role']) {
  switch (role) {
    case 'farmer': return farmerLinks;
    case 'sibat': return sibatLinks;
    case 'auction': return auctionLinks;
    default: return adminLinks;
  }
}

export function Sidebar({ role, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = getLinks(role);
  // should i add a uncollapsed button?

  const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 pb-2">
        {!collapsed && (
          <>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#2D5A27]">
              <Icon iconNode={cowHead} className="size-4" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate">
                SmartLivestock
              </span>
              <span className="text-[11px] text-white/50 truncate">
                Padre Garcia, Batangas
              </span>
            </div>
          </>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex ml-auto p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <Menu className="size-4" />
        </button>
      </div>

      <Separator className="bg-white/10 w-full my-1" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {!collapsed && (
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            Navigation
          </p>
        )}
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.path;
          return (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-[#2D5A27]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-white/10 mx-3 my-1" />

      {/* Footer */}
      <div className="px-3 pb-3">
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop — rendered as a flex child */}
      <aside className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 bg-[#2D5A27] text-white transition-all duration-300 shrink-0 border-r border-white/10",
        collapsed ? "w-[60px]" : "w-64"
      )}>
        <SidebarNav />
      </aside>

      {/* Mobile — hamburger + shadcn Sheet */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#2D5A27] text-white rounded-lg shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 border-0 bg-[#2D5A27] [&>button]:text-white [&>button]:top-4 [&>button]:right-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
