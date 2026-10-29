"use client";

import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePathname,useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SibatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  const isMapPage = pathname === "/sibat-monitoring" || pathname.startsWith("/sibat-monitoring");
  const role = user?.role?.toUpperCase();
  const isFieldReviewer = role === "SIBAT" || role === "CBAT";

  useEffect(() => {
    if (!isLoading && (!user || !isFieldReviewer)) {
      router.replace("/login");
    }
  }, [user, isLoading, isFieldReviewer, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!user || !isFieldReviewer) {
    return null;
  }

  return (
    <div className={cn("flex bg-slate-50 text-slate-900 antialiased", isMapPage ? "h-screen h-[100dvh] max-h-screen max-h-[100dvh] overflow-hidden" : "min-h-screen")}>
      <Sidebar
        role="sibat"
        onLogout={logout}
      />

      <main className={cn("flex-1 min-w-0 flex flex-col", isMapPage ? "h-full max-h-full overflow-hidden" : "overflow-y-auto")}>
        {isMapPage && (
          <div className="border-b border-emerald-900/10 bg-emerald-50/80 backdrop-blur-xs px-4 py-2.5 text-xs sm:text-sm leading-relaxed text-emerald-950 shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 border border-emerald-200/80">
                {role === "CBAT" ? "CBAT Field Node" : "SIBAT Node"}
              </span>
              <span className="text-slate-600 font-medium">
                Sector: <strong className="text-emerald-950 font-bold">{user.accessScope === "ALL_BARANGAYS" ? "All Barangays (Full Municipal Access)" : user.assignedBarangayName || "Unassigned — contact MAO/Admin"}</strong>
              </span>
              {user.accessScope === "ALL_BARANGAYS" && user.assignedBarangayName && (
                <span className="text-slate-400 text-xs">· Primary: {user.assignedBarangayName}</span>
              )}
            </div>
          </div>
        )}
        <div className={cn("flex-1 min-h-0", isMapPage ? "h-full overflow-hidden" : "nexus-ambient-bg")}>
          {children}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
