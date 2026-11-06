"use client";

import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePathname,useRouter } from "next/navigation";
import { useEffect } from "react";

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!user || user.role?.toUpperCase() !== "AUCTION") {
    return null;
  }

  return (
    <div className={cn("flex bg-[#f5f8f5] text-slate-900 antialiased", isMapPage ? "h-screen h-[100dvh] max-h-screen max-h-[100dvh] overflow-hidden" : "min-h-screen")}>
      <Sidebar
        role="auction"
        onLogout={logout}
      />

      <main className={cn("flex-1 min-w-0 relative isolate", isMapPage ? "h-full max-h-full overflow-hidden" : "overflow-y-auto nexus-ambient-bg")}>
        {!isMapPage && (
          <>
            {/* ── Futuristic Cyber Dot-Matrix Grid Background ── */}
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(rgba(16,185,129,0.16)_1.2px,transparent_1.2px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_85%_65%_at_50%_30%,#000_50%,transparent_100%)] opacity-80"
            />
            {/* ── Futuristic Ambient Glow Gradients ── */}
            <div
              aria-hidden="true"
              className="pointer-events-none fixed -top-40 -right-40 size-[32rem] rounded-full bg-emerald-500/10 blur-3xl -z-10"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none fixed -bottom-40 -left-40 size-[32rem] rounded-full bg-cyan-500/8 blur-3xl -z-10"
            />
          </>
        )}
        <div
          key={pathname}
          className={cn(
            "animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both motion-reduce:animate-none",
            isMapPage ? "h-full w-full" : "w-full"
          )}
        >
          {children}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
