'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Map,
  Sprout,
  LogOut,
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
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/components/ui/utils';
import { cowHead } from '@lucide/lab';
import { Icon } from 'lucide-react';
import { MOBILE_NAV_EVENT } from './mobile-nav-open';

interface SidebarProps {
  role: 'farmer' | 'lgu' | 'sibat' | 'auction';
  onLogout: () => void;
}

interface SidebarLink {
  path: string;
  label: string;
  icon: LucideIcon;
}

const adminLinks: SidebarLink[] = [
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

const farmerLinks: SidebarLink[] = [
  { path: '/farmer', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/livestock-inventory', label: 'Livestock Inventory', icon: Sprout },
  { path: '/production-dashboard', label: 'Production Dashboard', icon: ClipboardCheck },
  { path: '/gis-user-map', label: 'GIS User Map', icon: Map },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/farmer-announcement', label: 'News & Announcements', icon: Megaphone },
  { path: '/farmer-scheduling', label: 'Scheduling', icon: CalendarDays },
];

const sibatLinks: SidebarLink[] = [
  { path: '/sibat', label: 'Home', icon: LayoutDashboard },
  { path: '/sibat-validation', label: 'Validation', icon: ShieldCheck },
  { path: '/sibat-monitoring', label: 'Monitoring', icon: Activity },
  { path: '/sibat-alerts', label: 'Alerts', icon: Bell },
  { path: '/sibat-announcement', label: 'Announcement', icon: Megaphone },
];

const auctionLinks: SidebarLink[] = [
  { path: '/auction', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/auction-inspections', label: 'Inspections', icon: ClipboardCheck },
  { path: '/auction-announcement', label: 'Announcements', icon: Newspaper },
];

function getLinks(role: SidebarProps['role']): SidebarLink[] {
  switch (role) {
    case 'farmer': return farmerLinks;
    case 'sibat': return sibatLinks;
    case 'auction': return auctionLinks;
    default: return adminLinks;
  }
}

function SidebarNav({
  collapsed,
  links,
  pathname,
  onNavigate,
  onLogout,
}: {
  collapsed: boolean;
  links: SidebarLink[];
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5 pb-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2D5A27] shadow-xs">
          <Icon iconNode={cowHead} className="size-5" />
        </div>

        <div className={`flex flex-col min-w-0 transition-opacity duration-200 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <span className="text-base font-bold text-white truncate leading-tight">
            SmartLivestock
          </span>
          <span className="text-xs text-white/60 truncate">
            Padre Garcia, Batangas
          </span>
        </div>
      </div>

      <Separator className="bg-white/10 w-full my-1" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 space-y-1">
        <p className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/40 transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
          Navigation
        </p>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.path;
          return (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors",
                isActive
                  ? "bg-white text-[#2D5A27] font-bold shadow-xs"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className={`truncate transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-white/10 mx-3 my-1" />

      {/* Footer */}
      <div className="px-2.5 pb-3">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-base font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="size-5 shrink-0" />
          <span className={`truncate transition-opacity duration-200 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>Logout</span>
        </button>
      </div>
    </div>
  );
}

let sharedSidebarHovered = false;

function useSharedHovered() {
  const [isHovered, setIsHovered] = useState(sharedSidebarHovered);
  return [
    isHovered,
    (v: boolean) => {
      sharedSidebarHovered = v;
      setIsHovered(v);
    },
  ] as const;
}

export function Sidebar({ role, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useSharedHovered();

  const collapsed = !isHovered;
  const width = collapsed ? 64 : 280;
  const links = getLinks(role);

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(MOBILE_NAV_EVENT, open);
    return () => window.removeEventListener(MOBILE_NAV_EVENT, open);
  }, []);

  return (
    <>
      {/* Desktop — fixed sidebar overlays content, hover to uncollapse */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-[#2D5A27] text-white border-r border-white/10 overflow-hidden"
        style={{ width, transition: "width 200ms ease-in-out" }}
      >
        <SidebarNav collapsed={collapsed} links={links} pathname={pathname} onLogout={onLogout} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-0 bg-[#2D5A27] [&>button]:text-white [&>button]:top-4 [&>button]:right-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav
            collapsed={false}
            links={links}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            onLogout={onLogout}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
