"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";

export default function SibatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

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
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        role="sibat"
        onLogout={logout}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-950">
          Access: <strong>{user.accessScope === "ALL_BARANGAYS" ? "All Barangays" : user.assignedBarangayName || "Unassigned — contact MAO/Admin"}</strong>
          {user.accessScope === "ALL_BARANGAYS" && user.assignedBarangayName && <span> · Primary barangay: {user.assignedBarangayName}</span>}
        </div>
        {children}
      </main>

      <Toaster />
    </div>
  );
}
