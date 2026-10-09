"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/components/ui/utils";

export default function SibatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  const isMapPage = pathname === "/sibat-monitoring" || pathname.startsWith("/sibat-monitoring");

  useEffect(() => {
    if (!isLoading && (!user || user.role?.toUpperCase() !== "SIBAT")) {
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

  if (!user || user.role?.toUpperCase() !== "SIBAT") {
    return null;
  }

  return (
    <div className={cn("flex bg-slate-50 text-slate-900 antialiased", isMapPage ? "h-screen h-[100dvh] max-h-screen max-h-[100dvh] overflow-hidden" : "min-h-screen")}>
      <Sidebar
        role="sibat"
        onLogout={logout}
      />

      <main className={cn("flex-1 min-w-0 flex flex-col", isMapPage ? "h-full max-h-full overflow-hidden" : "overflow-y-auto")}>
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 shrink-0">
          Access: <strong>{user.accessScope === "ALL_BARANGAYS" ? "All Barangays" : user.assignedBarangayName || "Unassigned — contact MAO/Admin"}</strong>
          {user.accessScope === "ALL_BARANGAYS" && user.assignedBarangayName && <span> · Primary barangay: {user.assignedBarangayName}</span>}
        </div>
        <div className={cn("flex-1 min-h-0", isMapPage ? "h-full overflow-hidden" : "")}>
          {children}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
