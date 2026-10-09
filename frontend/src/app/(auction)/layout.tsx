"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import MobileNavAuction from "@/app/components/mobilenavauction";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/components/ui/utils";

export default function AuctionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  const isMapPage = pathname === "/auction-gis" || pathname.startsWith("/auction-gis");

  useEffect(() => {
    if (!isLoading && (!user || user.role?.toUpperCase() !== "AUCTION")) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!user || user.role?.toUpperCase() !== "AUCTION") {
    return null;
  }

  return (
    <div className={cn("flex bg-slate-50 text-slate-900 antialiased", isMapPage ? "h-screen h-[100dvh] max-h-screen max-h-[100dvh] overflow-hidden" : "min-h-screen")}>
      <Sidebar
        role="auction"
        onLogout={logout}
      />

      <main className={cn("flex-1 min-w-0", isMapPage ? "h-full max-h-full overflow-hidden" : "overflow-y-auto pb-16 md:pb-0")}>
        {children}
      </main>

      <MobileNavAuction />

      <Toaster />
    </div>
  );
}
