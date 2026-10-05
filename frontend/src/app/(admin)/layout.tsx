"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "sonner";
import { useAuth } from "@/contexts/auth-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const role = user?.role?.toUpperCase();
  const isAuthorized = role === "MAO" || role === "ADMIN";

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
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* 
        MAIN NAVIGATION SIDEBAR (Elevated Component):
        - Contains municipal administration links (Dashboard, Census, GIS Map, etc.).
        - Fixed desktop rail with high elevation (z-[1200] / z-[1300] on hover) so that
          full-screen canvas views (like Leaflet GIS Map) never obscure navigation links.
      */}
      <Sidebar
        role="lgu"
        onLogout={logout}
      />

      {/* 
        MAIN CONTENT REGION:
        - flex-1 min-w-0: Expands to fill available horizontal space next to the sidebar rail.
        - For /gis-map, the page fills 100dvh with zero margin/padding gaps.
      */}
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            color: "white",
            background: "transparent",
            boxShadow: "none",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)",
          },
        }}
      />
    </div>
  );
}
