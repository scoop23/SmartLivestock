import { Link, useLocation } from 'react-router';
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
  role: 'farmer' | 'lgu' | 'da';
  onLogout: () => void;
}

export function Sidebar({ role, onLogout }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminLinks = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/user-management', label: 'User Management', icon: Users },
    { path: '/data-validation', label: 'Data Validation', icon: CheckSquare },
    { path: '/gis-map', label: 'GIS Map', icon: Map },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const farmerLinks = [
    { path: '/farmer', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/livestock-inventory', label: 'Livestock Inventory', icon: Sprout },
    { path: '/production-logger', label: 'Production Logger', icon: BarChart3 },
    { path: '/alerts', label: 'Alerts', icon: CheckSquare },
  ];

  const links = role === 'farmer' ? farmerLinks : adminLinks;

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
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
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
