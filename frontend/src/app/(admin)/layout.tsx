"use client";

import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePathname,useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  const role = user?.role?.toUpperCase();
  const isAuthorized = role === "MAO" || role === "ADMIN";

  const isMapPage = pathname === "/gis-map" || pathname.startsWith("/gis-map");

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAuthorized) {
      if (pathname === "/notifications") {
        if (role === "SIBAT" || role === "CBAT") {
          router.replace("/sibat/notifications");
          return;
        }
        if (role === "FARMER") {
          router.replace("/farmer/notifications");
          return;
        }
        if (role === "AUCTION") {
          router.replace("/auction/notifications");
          return;
        }
        if (role === "SLAUGHTERHOUSESTAFF") {
          router.replace("/slaughterhouse/notifications");
          return;
        }
      }
      router.replace("/login");
    }
  }, [user, isLoading, isAuthorized, role, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return null;
  }

  return (
    <div className={cn("flex bg-slate-50 text-slate-900 antialiased", isMapPage ? "h-screen h-[100dvh] max-h-screen max-h-[100dvh] overflow-hidden" : "min-h-screen")}>
      <Sidebar
        role="lgu"
        onLogout={logout}
      />

      <main className={cn("flex-1 min-w-0", isMapPage ? "h-full max-h-full overflow-hidden" : "overflow-y-auto nexus-ambient-bg")}>{children}</main>

      <Toaster />
    </div>
  );
}
