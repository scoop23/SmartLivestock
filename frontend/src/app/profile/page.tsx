"use client";

import { PageHeader } from "@/app/components/page-header";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { UserProfileView } from "@/components/user-profile-view";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
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

  if (!user) {
    return null;
  }

  const role = user?.role?.toUpperCase();
  const sidebarRole =
    role === "FARMER"
      ? "farmer"
      : role === "SIBAT" || role === "CBAT"
      ? "sibat"
      : role === "AUCTION"
      ? "auction"
      : role === "SLAUGHTERHOUSESTAFF"
      ? "slaughterhouse"
      : "lgu";
  const headerVariant =
    role === "SLAUGHTERHOUSESTAFF"
      ? "slaughterhouse"
      : role === "AUCTION"
      ? "auction"
      : "farmer";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar role={sidebarRole} onLogout={logout} />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <PageHeader
          title="User Profile & Security Settings"
          subtitle="Manage your personal agricultural credentials, biosecurity alerts, and account access — Padre Garcia MAO"
          variant={headerVariant}
          wrapSubtitleOnMobile={role === "FARMER"}
          maxWidthClass="w-full"
        />

        <div className="p-3 sm:p-4 md:p-6 w-full">
          <UserProfileView />
        </div>
      </main>

      <Toaster />
    </div>
  );
}
