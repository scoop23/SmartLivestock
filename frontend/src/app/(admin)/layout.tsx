"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/components/ui/utils";

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
    if (!isLoading && (!user || !isAuthorized)) {
      router.replace("/login");
    }
  }, [user, isLoading, isAuthorized, router]);

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

      <main className={cn("flex-1 min-w-0", isMapPage ? "h-full max-h-full overflow-hidden" : "overflow-y-auto")}>{children}</main>

      <Toaster />
    </div>
  );
}
