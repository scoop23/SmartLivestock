"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "sonner";
import { useAuth } from "@/contexts/auth-context";

export default function FarmerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, logout, accessToken } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || user.role?.toUpperCase() !== "FARMER")) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        role="farmer"
        onLogout={logout}
      />

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
