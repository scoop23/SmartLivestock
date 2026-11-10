'use client';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { Popover,PopoverContent,PopoverTrigger } from '@/components/ui/popover';
import { Sheet,SheetContent,SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/components/ui/utils';
import { UniversalQrScannerDialog } from '@/components/universal-qr-scanner-dialog';
import { useAccessibilitySettings } from '@/contexts/accessibility-settings-context';
import { useAuth } from '@/contexts/auth-context';
import { cowHead } from '@lucide/lab';
import {
  Activity,
  ArrowLeftRight,
  BarChart2,
  BarChart3,
  Beef,
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Database,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Gavel,
  HelpCircle,
  History,
  Icon,
  Key,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Map,
  MapPin,
  Megaphone,
  Newspaper,
  Phone,
  Pin,
  PinOff,
  QrCode,
  Shield,
  ShieldPlus,
  Settings2,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Truck,
  UploadCloud,
  User as UserIcon,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import { MOBILE_NAV_EVENT } from './mobile-nav-open';

const CowHeadIcon = ({ className }: { className?: string }) => (
  <Icon iconNode={cowHead} className={className} />
);

interface SidebarProps {
  role: 'farmer' | 'lgu' | 'sibat' | 'auction' | 'slaughterhouse';
  onLogout: () => void;
}

export interface SidebarSubLink {
  path: string;
  label: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SidebarLink {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  hasNotificationDot?: boolean;
  exactMatch?: boolean;
  subLinks?: SidebarSubLink[];
}

const adminLinks: SidebarLink[] = [
  {
    path: '/admin',
    label: 'Dashboard',
    icon: LayoutGrid,
  },
  {
    path: '/user-management',
    label: 'User Management',
    icon: Users,
  },
  {
    path: '/livestock-records',
    label: 'Livestock Records',
    icon: CowHeadIcon,
  },
  {
    path: '/disease-mortality',
    label: 'Disease & Mortality',
    icon: ShieldPlus,
  },
  {
    path: '/data-overview',
    label: 'System Data',
    icon: Database,
  },
  {
    path: '/ownership-transfers',
    label: 'Auction',
    icon: Gavel,
  },
  {
    path: '/slaughter-record-review',
    label: 'Slaughter',
    icon: Beef,
  },
  {
    path: '/analysis',
    label: 'Analytics',
    icon: BarChart2,
    subLinks: [
      { path: '/analysis', label: 'Overview', icon: BarChart3 },
      { path: '/admin/census-analytics', label: 'Census Analytics', icon: FileSpreadsheet },
    ],
  },
  {
    path: '/gis-map',
    label: 'GIS Map',
    icon: MapPin,
  },
  {
    path: '/reports',
    label: 'Report Generation',
    icon: FileBarChart,
  },
  {
    path: '/data-uploads',
    label: 'Data Upload',
    icon: UploadCloud,
  },
  {
    path: '/news-announcements',
    label: 'Announcements',
    icon: Megaphone,
    hasNotificationDot: true,
  },
];

const farmerLinks: SidebarLink[] = [
  { path: '/farmer', label: 'Home', icon: LayoutDashboard },
  { path: '/livestock-inventory', label: 'Livestock', icon: CowHeadIcon },
  { path: '/production-dashboard', label: 'Production', icon: ClipboardCheck },
  { path: '/report-observation', label: 'Report', icon: Stethoscope },
  {
    path: '/gis-user-map',
    label: 'GIS Mapping',
    icon: Map,
  },
  { path: '/farmer-scheduling', label: 'Programs', icon: CalendarDays },
  { path: '/farmer-announcement', label: 'Announcement', icon: Megaphone },

];

const sibatLinks: SidebarLink[] = [
  { path: '/sibat', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sibat/livestock-registry', label: 'Livestock Records', icon: CowHeadIcon },
  { path: '/sibat-monitoring', label: 'Map', icon: Map },
  { path: '/sibat-alerts', label: 'Health Reports', icon: Stethoscope },
  { path: '/sibat/reports', label: 'Report Generation', icon: FileText },
  { path: '/sibat-scheduling', label: 'Programs', icon: CalendarDays },
  { path: '/sibat-announcement', label: 'Announcements', icon: Megaphone },
];

const auctionLinks: SidebarLink[] = [
  { path: '/auction', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/auction-analytics', label: 'Market Analytics', icon: BarChart3 },
  { path: '/auction-gate', label: 'Gate Check', icon: QrCode },

  { path: '/auction-preregistrations', label: 'Preregistrations', icon: CalendarCheck },
  { path: '/auction-ownership-transfers/registry', label: 'Transfer Records', icon: ArrowLeftRight },
  { path: '/auction-inspections', label: 'Intake Logs', icon: Truck },

  { path: '/auction-gis', label: 'Movement Map', icon: Map },
  { path: '/auction-announcement', label: 'Announcements', icon: Newspaper },
];

const slaughterhouseLinks: SidebarLink[] = [
  { path: '/slaughterhouse', label: 'Slaughter Records', icon: LayoutDashboard, exactMatch: true },
  { path: '/slaughterhouse/history', label: 'Slaughter History', icon: History },
  { path: '/slaughterhouse/announcements', label: 'Announcements', icon: Megaphone },
];

function getLinks(role: SidebarProps['role'], userRole?: string): SidebarLink[] {
  switch (role) {
    case 'farmer': return farmerLinks;
    case 'sibat': return sibatLinks;
    case 'auction': return auctionLinks;
    case 'slaughterhouse': return slaughterhouseLinks;
    default: return adminLinks;
  }
}

function getRoleBadge(role: SidebarProps['role']): { label: string; bg: string; text: string } {
  switch (role) {
    case 'farmer':
      return { label: 'Livestock Raiser', bg: 'bg-emerald-400/20', text: 'text-emerald-300' };
    case 'sibat':
      return { label: 'Field Reviewer', bg: 'bg-amber-400/20', text: 'text-amber-300' };
    case 'auction':
      return { label: 'Auction Staff', bg: 'bg-sky-400/20', text: 'text-sky-300' };
    case 'slaughterhouse':
      return { label: 'Slaughterhouse Staff', bg: 'bg-rose-400/20', text: 'text-rose-200' };
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
  onOpenScanner,
  popoverPortalContainer,
  profilePopoverOpen: controlledProfilePopoverOpen,
  onProfilePopoverOpenChange,
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
  onOpenScanner?: () => void;
  popoverPortalContainer?: HTMLElement | null;
  profilePopoverOpen?: boolean;
  onProfilePopoverOpenChange?: (open: boolean) => void;
  role: SidebarProps['role'];
}) {
  const { user } = useAuth();
  const isCbatUser = user?.role?.toUpperCase() === 'CBAT';
  const canManageSystemSettings = ['MAO', 'ADMIN'].includes(user?.role?.toUpperCase() ?? '');
  const roleBadge = getRoleBadge(role);

  const userDisplayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.email?.split('@')[0] || 'Authenticated User';

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase();

  const [internalProfilePopoverOpen, setInternalProfilePopoverOpen] = useState(false);
  const profilePopoverOpen = controlledProfilePopoverOpen ?? internalProfilePopoverOpen;
  const setProfilePopoverOpen = onProfilePopoverOpenChange ?? setInternalProfilePopoverOpen;
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      '/data-overview': true,
      '/data-overview?tab=disease': true,
    };
    links.forEach((link) => {
      const linkBase = link.path.split('?')[0];
      if (
        link.subLinks &&
        (pathname === linkBase ||
          pathname.startsWith(linkBase + "/") ||
          link.subLinks.some((s) => {
            const sBase = s.path.split('?')[0];
            return pathname === sBase || pathname.startsWith(sBase + "/");
          }))
      ) {
        initial[link.path] = true;
      }
    });
    return initial;
  });

  const toggleDropdown = (path: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpenDropdowns((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  return (
    <div className="flex flex-col h-full select-none bg-[#1E4D2B] border-r border-[#163b21] text-white">
      {/* Top Header Logo */}
      <div
        className={cn(
          "flex items-center gap-2 min-h-[68px] border-b border-white/10",
          collapsed
            ? "justify-center p-1.5"
            : onNavigate
              ? "justify-between pb-3 pl-3.5 pr-16 pt-3.5"
              : "justify-between p-3.5 pb-3"
        )}
      >
        <div className={cn("flex items-center min-w-0", collapsed ? "justify-center" : "gap-3")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#1E4D2B] shadow-md shadow-black/20 ring-2 ring-white/20 transition-transform duration-200 hover:scale-105">
            <Icon iconNode={cowHead} className="size-5.5 text-[#1E4D2B]" />
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
            data-tour={role === 'farmer' ? 'farmer-sidebar-pin' : undefined}
            onClick={onTogglePin}
            title={isPinned ? "Unpin sidebar (hover preview mode)" : "Pin sidebar (stay expanded)"}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4 rotate-45" />}
          </button>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav className="sidebar-nav-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 space-y-1.5">


        {links.map((link) => {
          const Icon = link.icon;
          const hasSubLinks = Boolean(link.subLinks && link.subLinks.length > 0);
          const isDropdownOpen = Boolean(openDropdowns[link.path]);

          const linkBasePath = link.path.split('?')[0];
          const isExactActive = pathname === linkBasePath;
          const isChildActive = Boolean(
            hasSubLinks && link.subLinks?.some((s) => {
              const sBase = s.path.split('?')[0];
              return pathname === sBase || pathname.startsWith(sBase + "/");
            })
          );
          const isAuctionTransferActive =
            link.path === '/auction-ownership-transfers/registry' &&
            pathname.startsWith('/auction-ownership-transfers');
          const isActive = isExactActive || isChildActive || isAuctionTransferActive || (
            !hasSubLinks &&
            !link.exactMatch &&
            link.path !== '/admin' &&
            link.path !== '/farmer' &&
            link.path !== '/sibat' &&
            link.path !== '/auction' &&
            (pathname === linkBasePath || pathname.startsWith(linkBasePath + "/"))
          );

          if (hasSubLinks && !collapsed) {
            return (
              <div key={link.path} className="space-y-1">
                <div
                  className={cn(
                    "group relative flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-semibold transition-all duration-200 cursor-pointer select-none",
                    "py-2.5 text-sm",
                    isActive && !isDropdownOpen
                      ? "bg-white/15 text-white font-bold backdrop-blur-xs ring-1 ring-white/20 shadow-xs scale-[1.01]"
                      : "text-emerald-100/75 hover:bg-white/10 hover:text-white hover:scale-[1.01] active:scale-[0.99]"
                  )}
                  onClick={(e) => toggleDropdown(link.path, e)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 truncate">
                    <Icon className={cn("size-5 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive && !isDropdownOpen ? "text-emerald-300 scale-105" : "text-emerald-200/70 group-hover:text-white")} />
                    <span className="truncate whitespace-nowrap text-sm font-semibold">{link.label}</span>
                  </div>

                  <span className="p-1 rounded-lg text-emerald-200/70 hover:text-white transition-colors">
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200",
                        isDropdownOpen ? "rotate-180 text-emerald-300" : "text-emerald-200/50"
                      )}
                    />
                  </span>
                </div>

                <div
                  id={`sublinks-${link.path.replace(/[\/?=]/g, '-')}`}
                  className={cn(
                    "grid transition-all duration-200 ease-in-out motion-reduce:transition-none",
                    isDropdownOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0 pointer-events-none"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="relative ml-5 pl-3.5 my-1 border-l-2 border-emerald-400/25 space-y-1">
                      {link.subLinks?.map((sub) => {
                        const SubIcon = sub.icon;
                        const sBase = sub.path.split('?')[0];
                        const isSubActive = pathname === sBase;
                        const subLabel =
                          isCbatUser && sub.path === "/sibat/batches" ? "Herd" : sub.label;
                        return (
                          <Link
                            key={sub.path}
                            href={sub.path}
                            onClick={() => onNavigate?.()}
                            tabIndex={isDropdownOpen ? 0 : -1}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200",
                              "py-2 text-xs",
                              isSubActive
                                ? "bg-emerald-500/25 text-white font-bold border border-emerald-400/30 shadow-xs scale-[1.01]"
                                : "text-emerald-100/70 hover:bg-white/10 hover:text-white hover:translate-x-1"
                            )}
                          >
                            {SubIcon && (
                              <SubIcon
                                className={cn(
                                  "size-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                                  isSubActive ? "text-emerald-300" : "text-emerald-200/70 group-hover:text-white"
                                )}
                              />
                            )}
                            <span className="truncate">{subLabel}</span>
                            {sub.badge && (
                              <span className="ml-auto text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                                {sub.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={link.path}
              data-tour={role === 'farmer' ? `farmer-sidebar-${link.path.slice(1)}` : undefined}
              href={link.path}
              title={collapsed ? link.label : undefined}
              onClick={() => onNavigate?.()}
              className={cn(
                "group relative flex items-center rounded-2xl font-semibold transition-all duration-200 select-none",
                collapsed ? "justify-center gap-0 px-0 py-3" : "gap-3 px-3.5 py-2.5",
                "py-2.5 text-sm",
                isActive
                  ? "bg-white/15 text-white font-bold backdrop-blur-xs ring-1 ring-white/20 shadow-xs scale-[1.01]"
                  : "text-emerald-100/75 hover:bg-white/10 hover:text-white hover:scale-[1.01] active:scale-[0.99]"
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-emerald-300 scale-105" : "text-emerald-200/70 group-hover:text-white"
                )}
              />
              <span
                className={cn(
                  "truncate whitespace-nowrap text-sm font-semibold transition-all duration-200",
                  collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[200px]"
                )}
              >
                {link.label}
              </span>

              {isActive && !collapsed && (
                <span className="ml-auto size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              )}

              {link.hasNotificationDot && !collapsed && (
                <span className="ml-auto relative flex size-2.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-rose-500 ring-2 ring-[#1E4D2B]" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer Section: User Profile & Help Button */}
      <div className="border-t border-white/10 p-2.5 space-y-1.5 bg-black/15 flex flex-col">
        {/* Universal QR Scanner Button for Staff Roles (Admin, SIBAT, Auction) */}
        {role !== 'farmer' && onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            title={collapsed ? "Scan QR Pass / Tag" : undefined}
            className={`flex items-center w-full ${collapsed ? "justify-center gap-0 p-1.5" : "gap-3 px-2 py-2"} rounded-xl text-sm font-semibold bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 hover:text-white border border-emerald-400/25 transition-all cursor-pointer group shadow-xs`}
          >
            <div className="size-8 rounded-lg bg-emerald-400/25 text-emerald-300 flex items-center justify-center shrink-0 group-hover:bg-emerald-400 group-hover:text-[#1E4D2B] group-hover:scale-105 transition-all">
              <QrCode className="size-4.5" />
            </div>
            <div
              className={cn(
                "flex flex-col text-left truncate whitespace-nowrap transition-all duration-200",
                collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[180px]"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black leading-tight text-white">Scan QR Pass</span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm bg-emerald-400/30 text-emerald-200">
                  Staff
                </span>
              </div>
              <span className="text-[10px] text-emerald-200/70 leading-tight">
                {isCbatUser ? "Herds, Tags & Passes" : "Batches, Tags & Passes"}
              </span>
            </div>
          </button>
        )}

        {/* Help & Support Button */}
        <button
          type="button"
          data-tour={role === 'farmer' ? 'farmer-sidebar-help' : undefined}
          onClick={onOpenHelp}
          title={collapsed ? "Help & Support" : undefined}
          className={`flex items-center w-full ${collapsed ? "justify-center gap-0 p-1.5" : "gap-3 px-2 py-2"} rounded-xl text-sm font-semibold text-emerald-100 hover:bg-white/10 hover:text-white transition-all cursor-pointer group`}
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

        {/* User Card with Interactive Popover */}
        <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-tour={role === 'farmer' ? 'farmer-sidebar-profile' : undefined}
              className={cn(
                "group w-full h-12 min-h-12 shrink-0 flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-emerald-400/40",
                collapsed ? "justify-center p-1.5" : "gap-2"
              )}
              title={`${userDisplayName}${user?.email ? ` · ${user.email}` : ""} · Profile & Options`}
            >
              <div className={cn("flex items-center min-w-0", collapsed ? "justify-center gap-0" : "gap-2.5")}>
                <div className="size-7 rounded-full bg-emerald-600 border border-emerald-300/40 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                  {user?.profileImage ? (
                    <img src={user.profileImage} alt={userDisplayName} className="size-full object-cover" />
                  ) : (
                    userInitials
                  )}
                </div>

                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-200",
                    collapsed ? "opacity-0 w-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[130px]"
                  )}
                >
                  <span className="block truncate whitespace-nowrap text-xs font-bold leading-tight text-white group-hover:text-emerald-200 transition-colors">
                    {userDisplayName}
                  </span>
                  <span className="block truncate whitespace-nowrap text-[10px] text-emerald-200/60">
                    {user?.email || 'Padre Garcia'}
                  </span>
                </div>
              </div>

              {!collapsed && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="p-1 rounded-md text-emerald-200/60 group-hover:text-white transition-colors">
                    <ChevronDown className={cn("size-3.5 transition-transform duration-200", profilePopoverOpen ? "rotate-180 text-emerald-300" : "")} />
                  </span>
                </div>
              )}
            </button>
          </PopoverTrigger>

          {/* Popover elevated to z-[var(--z-popover)] to always float cleanly above elevated sidebars and map controls */}
          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={8}
            portalContainer={onNavigate ? popoverPortalContainer : undefined}
            className={cn(
              "w-72 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-0 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 animate-in fade-in-50 zoom-in-95",
              // The mobile profile menu is portaled outside the modal drawer, so it must sit above that drawer's overlay.
              onNavigate ? "z-[var(--z-popover-dialog)]" : "z-[var(--z-popover)]"
            )}
          >
            {/* Popover Header with Avatar & Department */}
            <div className="p-3.5 bg-gradient-to-br from-emerald-800 via-[#2D5A27] to-[#1c3c18] text-white">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-white/20 border border-white/30 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                  {user?.profileImage ? (
                    <img src={user.profileImage} alt={userDisplayName} className="size-full object-cover" />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white whitespace-normal break-words">
                    {userDisplayName}
                  </span>
                  <span className="text-[11px] text-emerald-200/80 break-all">
                    {user?.email || 'padregarcia@gov.ph'}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md", roleBadge.bg, roleBadge.text)}>
                      {roleBadge.label}
                    </span>
                    <span className="text-[10px] text-emerald-200/70 font-medium">Padre Garcia</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-1.5 space-y-0.5">
              <Link
                href="/profile"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  onNavigate?.();
                }}
                className="flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 transition-colors group cursor-pointer"
              >
                <div className="size-7 rounded-lg bg-emerald-100/70 text-[#2D5A27] flex items-center justify-center shrink-0 group-hover:bg-[#2D5A27] group-hover:text-white transition-colors">
                  <UserIcon className="size-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span>My Profile & Account</span>
                  <span className="text-[10px] text-slate-400 font-normal">Contact info & barangay</span>
                </div>
              </Link>

              <Link
                href="/profile?tab=security"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  onNavigate?.();
                }}
                className="flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 transition-colors group cursor-pointer"
              >
                <div className="size-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                  <Key className="size-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span>Security & Password</span>
                  <span className="text-[10px] text-slate-400 font-normal">Change password & 2FA</span>
                </div>
              </Link>

              <Link
                href="/profile?tab=alerts"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  onNavigate?.();
                }}
                className="flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 transition-colors group cursor-pointer"
              >
                <div className="size-7 rounded-lg bg-amber-100/70 text-amber-800 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Bell className="size-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span>Alert Preferences</span>
                  <span className="text-[10px] text-slate-400 font-normal">Biosecurity notices & emails</span>
                </div>
              </Link>

              {canManageSystemSettings && (
                <Link
                  href="/system-settings"
                  onClick={() => {
                    setProfilePopoverOpen(false);
                    onNavigate?.();
                  }}
                  className="flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 transition-colors group cursor-pointer"
                >
                  <div className="size-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                    <Settings2 className="size-3.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>System Settings</span>
                    <span className="text-[10px] text-slate-400 font-normal">Municipal options & notifications</span>
                  </div>
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  onOpenHelp();
                }}
                className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 transition-colors group cursor-pointer text-left"
              >
                <div className="size-7 rounded-lg bg-sky-100/70 text-sky-800 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <HelpCircle className="size-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span>Help & Hotlines</span>
                  <span className="text-[10px] text-slate-400 font-normal">Emergency contacts & guide</span>
                </div>
              </button>
            </div>

            <div className="h-px bg-slate-100 my-1" />

            <div className="p-1.5 pt-0">
              <button
                type="button"
                onClick={() => {
                  setProfilePopoverOpen(false);
                  onNavigate?.();
                  onLogout();
                }}
                className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors group cursor-pointer text-left"
              >
                <div className="size-7 rounded-lg bg-red-100/70 text-red-600 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <LogOut className="size-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span>Sign Out</span>
                  <span className="text-[10px] text-red-400 font-normal">End active session</span>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function Sidebar({ role, onLogout }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { fontScale } = useAccessibilitySettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [desktopProfilePopoverOpen, setDesktopProfilePopoverOpen] = useState<boolean>(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState<boolean>(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState<boolean>(false);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [mobileSheetContent, setMobileSheetContent] = useState<HTMLDivElement | null>(null);
  const pinnedBeforeFarmerTour = useRef<boolean | null>(null);
  const isPinnedRef = useRef(isPinned);

  const requestLogout = () => setLogoutConfirmationOpen(true);
  const confirmLogout = () => {
    setLogoutConfirmationOpen(false);
    onLogout();
  };

  useEffect(() => {
    isPinnedRef.current = isPinned;
  }, [isPinned]);

  useEffect(() => {
    const syncTourPin = (event: Event) => {
      if (role !== 'farmer') return;
      const active = (event as CustomEvent<{ active: boolean }>).detail?.active;
      if (active) {
        if (pinnedBeforeFarmerTour.current === null) {
          pinnedBeforeFarmerTour.current = isPinnedRef.current;
        }
        setIsPinned(true);
        return;
      }

      if (pinnedBeforeFarmerTour.current !== null) {
        setIsPinned(pinnedBeforeFarmerTour.current);
        pinnedBeforeFarmerTour.current = null;
      }
    };

    window.addEventListener('smartlivestock:farmer-dashboard-tour-sidebar', syncTourPin);
    return () => window.removeEventListener('smartlivestock:farmer-dashboard-tour-sidebar', syncTourPin);
  }, [role]);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_pinned");
    if (saved !== null) {
      window.requestAnimationFrame(() => setIsPinned(saved === "true"));
    }
  }, []);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_pinned", String(next));
      return next;
    });
  };

  const isExtraLargeText = fontScale === "extra-large";
  const collapsedSidebarWidth = isExtraLargeText ? 80 : fontScale === "comfortable" ? 72 : 64;
  const expandedSidebarWidth = isExtraLargeText ? 360 : 280;
  const isExpanded = isPinned || isHovered || desktopProfilePopoverOpen;
  const links = getLinks(role, user?.role ?? undefined);

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(MOBILE_NAV_EVENT, open);
    return () => window.removeEventListener(MOBILE_NAV_EVENT, open);
  }, []);

  return (
    <>
      {/* 
        ═════════════════════════════════════════════════════════════════════
        DESKTOP NAVIGATION RAIL & FLOATING PANEL (High Elevation: z-[var(--z-sidebar)])
        ═════════════════════════════════════════════════════════════════════
        CONCEPT: Stacking Context & Leaflet Map Integration
        - Leaflet GIS maps create deep stacking contexts:
            * tilePane: z-index 200
            * overlayPane: z-index 400
            * markerPane: z-index 600
            * popupPane: z-index 700
            * Leaflet controls: z-index 1000
        - If the main navigation sidebar only uses z-30 or z-50, Leaflet layers
          and GIS controls will overlap or block interaction with the sidebar.
        - By elevating the sidebar rail to z-[var(--z-sidebar)] and the expanded hover/pinned
          panel to z-[var(--z-sidebar-hover)], the main navigation is guaranteed to float smoothly
          above the GIS map canvas, markers, popups, and floating overlays.
      */}
      <div
        className="hidden lg:block relative shrink-0 z-[var(--z-sidebar)] transition-[width] duration-200 ease-out"
        style={{ width: isPinned ? expandedSidebarWidth : collapsedSidebarWidth }}
      >
        {/* Sidebar Panel: Smooth floating overlay on hover, locks in place when pinned */}
        <aside
          onMouseEnter={() => !isPinned && setIsHovered(true)}
          onMouseLeave={() => !isPinned && setIsHovered(false)}
          onTransitionEnd={() => {
            if (desktopProfilePopoverOpen) {
              window.dispatchEvent(new Event("resize"));
            }
          }}
          className={cn(
            "fixed inset-y-0 left-0 flex flex-col bg-[#2D5A27] text-white border-r border-white/10 overflow-hidden transform-gpu transition-[width,box-shadow] duration-200 ease-in-out",
            isPinned
              ? "z-[var(--z-sidebar)] shadow-xl"
              : isHovered || desktopProfilePopoverOpen
                ? "shadow-2xl z-[var(--z-sidebar-hover)]"
                : "z-[var(--z-sidebar)] shadow-md"
          )}
          style={{ width: isExpanded ? expandedSidebarWidth : collapsedSidebarWidth }}
        >
          <SidebarNav
            collapsed={!isExpanded}
            isPinned={isPinned}
            onTogglePin={togglePin}
            links={links}
            pathname={pathname}
            onLogout={requestLogout}
            onOpenHelp={() => setHelpDialogOpen(true)}
            onOpenScanner={() => setScannerOpen(true)}
            profilePopoverOpen={desktopProfilePopoverOpen}
            onProfilePopoverOpenChange={setDesktopProfilePopoverOpen}
            role={role}
          />
        </aside>
      </div>

      {/* Mobile — slide-over sheet drawer (Elevated to z-[var(--z-sidebar)] to sit cleanly above mobile map views) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent ref={setMobileSheetContent} side="left" className="w-[min(20rem,88vw)] p-0 border-0 bg-[#2D5A27] z-[var(--z-dialog)] [&>button]:top-4 [&>button]:right-4 [&>button]:inline-flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center [&>button]:p-0 [&>button]:text-white">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav
            collapsed={false}
            links={links}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            onLogout={requestLogout}
            onOpenHelp={() => {
              setMobileOpen(false);
              setHelpDialogOpen(true);
            }}
            onOpenScanner={() => {
              setMobileOpen(false);
              setScannerOpen(true);
            }}
            popoverPortalContainer={mobileSheetContent}
            role={role}
          />
        </SheetContent>
      </Sheet>

      {/* ═════════════════════════════════════════════════════════════════════
          SIDEBAR CONFIRMATION AND HELP DIALOGS
         ═════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={logoutConfirmationOpen} onOpenChange={setLogoutConfirmationOpen}>
        <AlertDialogContent className="overflow-hidden rounded-3xl border border-emerald-200/80 bg-white p-0 text-slate-900 shadow-[0_20px_70px_rgba(15,23,42,0.18)]">
          <div className="relative overflow-hidden rounded-[inherit]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-emerald-100/80 via-cyan-50/75 to-transparent"
            />
            <div className="relative space-y-6 p-6 sm:p-7">
              <AlertDialogHeader className="items-start space-y-4 text-left sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_8px_24px_rgba(16,185,129,0.12)]">
                    <LogOut className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-800">
                      Secure session control
                    </p>
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]" />
                      Session active
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <AlertDialogTitle className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                    Are you sure you want to sign out?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-relaxed text-slate-600">
                    Your session on this device will end. You can sign in again at any time.
                  </AlertDialogDescription>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:justify-end">
                <AlertDialogCancel className="h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmLogout}
                  className="h-11 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-[#1E4D2B] via-emerald-800 to-emerald-600 px-5 font-semibold text-white shadow-lg shadow-emerald-950/25 transition-all hover:from-[#163b21] hover:to-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-[2rem] p-6 sm:p-8 bg-white border-none shadow-2xl z-[var(--z-critical)]">
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
                    Navigate to <strong>Livestock Inventory</strong> from the sidebar and click <strong>&quot;Add Livestock&quot;</strong>. Enter the tag number, breed, sex, weight, and vaccination history.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">How do I log dairy milk or meat production?</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Choose <strong>Record an activity</strong>, select milk or meat, then choose an approved animal and enter the amount and date. The entry is saved in your farm history. For an individual animal’s meat yield, the system also sends a slaughter notice to MAO for review.
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
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════
          UNIVERSAL QR PASS SCANNER DIALOG (FOR STAFF ROLES)
         ═════════════════════════════════════════════════════════════════════ */}
      {role !== 'farmer' && role !== 'slaughterhouse' && (
        <UniversalQrScannerDialog
          isOpen={scannerOpen}
          onOpenChange={setScannerOpen}
          role={role === 'lgu' ? 'admin' : role}
        />
      )}
    </>
  );
}
