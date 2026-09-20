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
  Stethoscope,
  Pin,
  PinOff,
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/components/ui/utils';
import { cowHead } from '@lucide/lab';
import { Icon } from 'lucide-react';
import { MOBILE_NAV_EVENT } from './mobile-nav-open';
import { useAuth } from '@/contexts/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  { path: '/news-announcements', label: 'News & Updates', icon: Newspaper },
  { path: '/schedules', label: 'Farmer Schedules', icon: CalendarDays },
];

const farmerLinks: SidebarLink[] = [
  { path: '/farmer', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/livestock-inventory', label: 'Livestock Inventory', icon: Sprout },
  { path: '/production-dashboard', label: 'Production Logs', icon: ClipboardCheck },
  { path: '/report-observation', label: 'Report Illness/Mortality', icon: Stethoscope },
  { path: '/gis-user-map', label: 'GIS Farm Map', icon: Map },
  { path: '/alerts', label: 'Alerts & Notices', icon: Bell },
  { path: '/farmer-announcement', label: 'Announcements', icon: Megaphone },
  { path: '/farmer-scheduling', label: 'Field Scheduling', icon: CalendarDays },
];

const sibatLinks: SidebarLink[] = [
  { path: '/sibat', label: 'Inspection Home', icon: LayoutDashboard },
  { path: '/sibat-validation', label: 'Data Validation', icon: ShieldCheck },
  { path: '/sibat-monitoring', label: 'Field Monitoring', icon: Activity },
  { path: '/sibat-alerts', label: 'Alerts & Flags', icon: Bell },
  { path: '/sibat-announcement', label: 'Announcements', icon: Megaphone },
];

const auctionLinks: SidebarLink[] = [
  { path: '/auction', label: 'Market Dashboard', icon: LayoutDashboard },
  { path: '/auction-inspections', label: 'Health Inspections', icon: ClipboardCheck },
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

function getRoleBadge(role: SidebarProps['role']): { label: string; bg: string; text: string } {
  switch (role) {
    case 'farmer':
      return { label: 'Livestock Raiser', bg: 'bg-emerald-400/20', text: 'text-emerald-300' };
    case 'sibat':
      return { label: 'SIBAT Inspector', bg: 'bg-amber-400/20', text: 'text-amber-300' };
    case 'auction':
      return { label: 'Auction Staff', bg: 'bg-sky-400/20', text: 'text-sky-300' };
    default:
      return { label: 'MAO Admin', bg: 'bg-white/20', text: 'text-white' };
  }
}

function SidebarNav({
  collapsed,
  isPinned,
  onTogglePin,
  links,
  pathname,
  onNavigate,
  onLogout,
  onOpenHelp,
  role,
}: {
  collapsed: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  links: SidebarLink[];
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  onOpenHelp: () => void;
  role: SidebarProps['role'];
}) {
  const { user } = useAuth();
  const roleBadge = getRoleBadge(role);

  const userDisplayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.email?.split('@')[0] || 'Authenticated User';

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="flex flex-col h-full select-none bg-gradient-to-b from-[#244b1f] via-[#2D5A27] to-[#1c3a18] text-white">
      {/* Top Header Logo */}
      <div className="flex items-center justify-between gap-2 p-3.5 pb-3 min-h-[68px] border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#2D5A27] shadow-md shadow-black/20 ring-2 ring-white/20">
            <Icon iconNode={cowHead} className="size-5.5 text-[#2D5A27]" />
          </div>

          <div
            className={cn(
              "flex flex-col min-w-0 whitespace-nowrap transition-all duration-200",
              collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[170px]"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-white tracking-tight truncate leading-tight">
                SmartLivestock
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={cn("text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md", roleBadge.bg, roleBadge.text)}>
                {roleBadge.label}
              </span>
            </div>
          </div>
        </div>

        {onTogglePin && !collapsed && (
          <button
            type="button"
            onClick={onTogglePin}
            title={isPinned ? "Unpin sidebar (hover preview mode)" : "Pin sidebar (stay expanded)"}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4 rotate-45" />}
          </button>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/20">
        <p
          className={cn(
            "px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 whitespace-nowrap transition-all duration-200",
            collapsed ? "opacity-0 h-0 py-0 overflow-hidden" : "opacity-100"
          )}
        >
          Menu
        </p>

        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.path || (link.path !== '/admin' && link.path !== '/farmer' && link.path !== '/sibat' && link.path !== '/auction' && pathname.startsWith(link.path));

          return (
            <Link
              key={link.path}
              href={link.path}
              title={collapsed ? link.label : undefined}
              onClick={() => onNavigate?.()}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                isActive
                  ? "bg-white text-[#2D5A27] font-bold shadow-md shadow-black/15 ring-1 ring-white/30"
                  : "text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
              )}
            >
              <Icon className={cn("size-5 shrink-0 transition-transform duration-150", isActive ? "text-[#2D5A27] scale-105" : "text-white/80 group-hover:text-white")} />
              <span
                className={cn(
                  "truncate whitespace-nowrap transition-all duration-200",
                  collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[200px]"
                )}
              >
                {link.label}
              </span>

              {isActive && !collapsed && (
                <span className="ml-auto size-1.5 rounded-full bg-[#2D5A27]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer Section: User Profile & Help Button */}
      <div className="border-t border-white/10 p-2.5 space-y-1.5 bg-black/15">
        {/* Help & Support Button */}
        <button
          type="button"
          onClick={onOpenHelp}
          title={collapsed ? "Help & Support" : undefined}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-semibold text-emerald-100 hover:bg-white/10 hover:text-white transition-all cursor-pointer group"
        >
          <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30 group-hover:scale-105 transition-all">
            <HelpCircle className="size-4.5" />
          </div>
          <div
            className={cn(
              "flex flex-col text-left truncate whitespace-nowrap transition-all duration-200",
              collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[180px]"
            )}
          >
            <span className="text-xs font-bold leading-tight text-white">Help & Support</span>
            <span className="text-[10px] text-emerald-200/60 leading-tight">Hotlines & Guides</span>
          </div>
        </button>

        {/* User Card */}
        <div
          className={cn(
            "flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 transition-all",
            collapsed ? "justify-center p-1.5" : "gap-2"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-full bg-emerald-700/80 border border-emerald-400/30 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              {userInitials}
            </div>

            <div
              className={cn(
                "flex flex-col min-w-0 whitespace-nowrap transition-all duration-200",
                collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[130px]"
              )}
            >
              <span className="text-xs font-bold text-white truncate leading-tight">
                {userDisplayName}
              </span>
              <span className="text-[10px] text-emerald-200/60 truncate">
                {user?.email || 'Padre Garcia'}
              </span>
            </div>
          </div>

          {!collapsed && (
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-rose-300/80 hover:text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>

        {/* Collapsed logout icon */}
        {collapsed && (
          <button
            onClick={onLogout}
            title="Logout"
            className="flex items-center justify-center w-full p-2 rounded-xl text-rose-300/80 hover:text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="size-4.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ role, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_pinned");
    if (saved !== null) {
      setIsPinned(saved === "true");
    }
  }, []);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_pinned", String(next));
      return next;
    });
  };

  const isExpanded = isPinned || isHovered;
  const links = getLinks(role);

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(MOBILE_NAV_EVENT, open);
    return () => window.removeEventListener(MOBILE_NAV_EVENT, open);
  }, []);

  return (
    <>
      {/* Desktop — Fixed in-flow rail on document (64px or 280px when pinned) */}
      <div
        className="hidden lg:block relative shrink-0 z-30 transition-[width] duration-200 ease-out"
        style={{ width: isPinned ? 280 : 64 }}
      >
        {/* Sidebar Panel: Smooth floating overlay on hover, locks in place when pinned */}
        <aside
          onMouseEnter={() => !isPinned && setIsHovered(true)}
          onMouseLeave={() => !isPinned && setIsHovered(false)}
          className={cn(
            "fixed inset-y-0 left-0 flex flex-col bg-[#2D5A27] text-white border-r border-white/10 overflow-hidden transform-gpu",
            isPinned
              ? "w-[280px] z-30"
              : isHovered
              ? "w-[280px] shadow-2xl z-50 transition-[width,box-shadow] duration-200 ease-out"
              : "w-16 z-30 transition-[width] duration-200 ease-in-out"
          )}
        >
          <SidebarNav
            collapsed={!isExpanded}
            isPinned={isPinned}
            onTogglePin={togglePin}
            links={links}
            pathname={pathname}
            onLogout={onLogout}
            onOpenHelp={() => setHelpDialogOpen(true)}
            role={role}
          />
        </aside>
      </div>

      {/* Mobile — slide-over sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-0 bg-[#2D5A27] [&>button]:text-white [&>button]:top-4 [&>button]:right-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav
            collapsed={false}
            links={links}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            onLogout={onLogout}
            onOpenHelp={() => {
              setMobileOpen(false);
              setHelpDialogOpen(true);
            }}
            role={role}
          />
        </SheetContent>
      </Sheet>

      {/* ═════════════════════════════════════════════════════════════════════
          INTERACTIVE HELP & SUPPORT MODAL DIALOG
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-[2rem] p-6 sm:p-8 bg-white border-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center shrink-0">
                <HelpCircle className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  SmartLivestock Help & Support
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  Official assistance, hotline contacts, and guides for the Municipality of Padre Garcia.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-3 text-slate-700 text-sm">
            {/* Hotlines & Contacts Card */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Phone className="size-4 text-[#2D5A27]" />
                Emergency & Office Contacts
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#2D5A27] block">
                    MAO Central Office
                  </span>
                  <p className="text-xs font-bold text-slate-900">(043) 515-2888</p>
                  <p className="text-[11px] text-slate-500">mao@padregarcia.gov.ph</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 block">
                    Veterinary & Biosecurity Desk
                  </span>
                  <p className="text-xs font-bold text-slate-900">(043) 515-2889</p>
                  <p className="text-[11px] text-slate-500">Rapid animal health response</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-sky-800 block">
                    SIBAT Field Inspection Desk
                  </span>
                  <p className="text-xs font-bold text-slate-900">(043) 515-2890</p>
                  <p className="text-[11px] text-slate-500">Scheduled on-farm audits</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Clock className="size-3 text-slate-500" /> Office Hours
                  </span>
                  <p className="text-xs font-bold text-slate-900">Mon - Fri: 8:00 AM - 5:00 PM</p>
                  <p className="text-[11px] text-slate-500">Municipal Hall, Poblacion</p>
                </div>
              </div>
            </div>

            {/* Quick Guides & FAQs */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <FileText className="size-4 text-[#2D5A27]" />
                User Quick Guides
              </h3>

              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">How do I register a new cow or cattle head?</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Navigate to <strong>Livestock Inventory</strong> from the sidebar and click <strong>"Add Livestock"</strong>. Enter the tag number, breed, sex, weight, and vaccination history.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">How do I log dairy milk or meat production?</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Go to <strong>Production Dashboard</strong> and tap <strong>"Log Daily Milk"</strong> or <strong>"Record Meat Yield"</strong>. Entries are queued for SIBAT and MAO review.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">What should I do if an animal shows symptoms of disease?</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Immediately click <strong>Report Observation</strong> to send a high-priority biosecurity alert directly to the Municipal Veterinarian.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Privacy & Compliance Note */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <Shield className="size-5 text-[#2D5A27] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-emerald-950">Data Privacy Act (RA 10173) Compliance</h4>
                <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                  Your livestock records and personal data are protected by the LGU of Padre Garcia and used solely for agricultural programs, census surveillance, and veterinary aid.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setHelpDialogOpen(false)}
              className="w-full py-5 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black rounded-2xl text-xs uppercase tracking-wider"
            >
              Close Help Center
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
