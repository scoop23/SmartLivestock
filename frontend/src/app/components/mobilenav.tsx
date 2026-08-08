"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  LogOut,
  Megaphone,
  Menu,
  Package,
  TrendingUp,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import GisGlobePoi from "@/components/icons/GisGlobePoi";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/components/ui/utils";

const HomeIcon = (props: { className?: string }) => (
  <Icon iconNode={cowHead} {...props} />
);

interface NavLink {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}

const links: NavLink[] = [
  { path: "/farmer", label: "Home", icon: HomeIcon },
  { path: "/livestock-inventory", label: "Inventory", icon: Package },
  { path: "/production-dashboard", label: "Logger", icon: TrendingUp },
  { path: "/alerts", label: "Alerts", icon: Bell, alert: true },
  { path: "/gis-user-map", label: "GIS", icon: GisGlobePoi },
  { path: "/farmer-announcement", label: "Announcement", icon: Megaphone },
  { path: "/farmer-scheduling", label: "Scheduling", icon: Calendar },
];

export default function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 bg-white text-[#2D5A27] rounded-full shadow-lg shadow-black/20"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0 border-0 bg-[#2D5A27] [&>button]:text-white [&>button]:top-4 [&>button]:right-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>

          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-4 pb-2">
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
            </div>

            <Separator className="bg-white/10 w-full my-1" />

            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Navigation
              </p>
              {links.map((link) => {
                const isActive = pathname === link.path;
                const Icon = link.icon;
                return (
                  <button
                    key={link.path}
                    onClick={() => go(link.path)}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-white text-[#2D5A27]"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate flex-1 text-left">
                      {link.label}
                    </span>
                    {link.alert && (
                      <span className="shrink-0 size-2 rounded-full bg-[#D32F2F]" />
                    )}
                  </button>
                );
              })}
            </nav>

            <Separator className="bg-white/10 mx-3 my-1" />

            <div className="px-3 pb-3">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="size-4 shrink-0" />
                <span className="truncate">Logout</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
