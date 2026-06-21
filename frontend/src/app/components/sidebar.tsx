'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  Map, 
  BarChart3, 
  Sprout,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  role: 'farmer' | 'lgu' | 'sibat';
  onLogout: () => void;
}

export function Sidebar({ role, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminLinks = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/data-overview', label: 'System Data', icon: Users },
    { path: '/user-management', label: 'User Management', icon: Users },
    { path: '/data-validation', label: 'Data Validation', icon: CheckSquare },
    { path: '/gis-map', label: 'GIS Map', icon: Map },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
    { path: '/data-uploads', label: 'Data Upload', icon: BarChart3 },
    { path: '/news-announcements', label: 'News And Announcements', icon: BarChart3 },
    { path: '/schedules', label: 'Schedules from Farmers', icon: BarChart3 },
  ];

  const farmerLinks = [
    { path: '/farmer', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/livestock-inventory', label: 'Livestock Inventory', icon: Sprout },
    { path: '/production-logger', label: 'Production Logger', icon: BarChart3 },
    { path: '/gis-user-map', label: 'GIS User Map', icon: CheckSquare },
    { path: '/alerts', label: 'Alerts', icon: CheckSquare },
    { path: '/farmer-announcement', label: 'News & Announcements', icon: CheckSquare },
    { path: '/farmer-scheduling', label: 'Scheduling', icon: CheckSquare },
  ];
  
  const sibatLinks = [
    { path: '/sibat', label: 'Home', icon: LayoutDashboard },
    { path: '/sibat-validation', label: 'Validation', icon: LayoutDashboard },
    { path: '/sibat-monitoring', label: 'Monitoring', icon: LayoutDashboard },
    { path: '/sibat-alerts', label: 'Alerts', icon: LayoutDashboard },
    { path: '/sibat-announcement', label: 'Annnouncement', icon: LayoutDashboard },
  ]

  //  { path: '/alerts', label: 'Alerts', icon: CheckSquare },

  const links = () => {
    if (role === 'farmer') return farmerLinks
    else if (role === 'sibat') return sibatLinks
    else return adminLinks
  }

  const SidebarContent = () => (
    <div className="h-full flex flex-col bg-[#2D5A27] text-white">
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <div>
            <h1 className="text-xl text-white">SmartLivestock</h1>
            <p className="text-sm text-white/80">Padre Garcia, Batangas</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:block p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {links().map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.path;
          return (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-white text-[#2D5A27]'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:block ${collapsed ? 'w-20' : 'w-64'} transition-all duration-300 flex-shrink-0`}>
        <div className="h-screen sticky top-0">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#2D5A27] text-white rounded-lg shadow-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 w-64 z-50">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}