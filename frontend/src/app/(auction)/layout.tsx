"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import MobileNavAuction from "@/app/components/mobilenavauction";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";

export default function AuctionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This client-side gate keeps Auction routes out of other roles' navigation.
  // Django still checks authentication and role permissions on every API request.
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

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

  // All Auction pages share this shell; route page components render in <main>.
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        role="auction"
        onLogout={logout}
      />

      <main className="flex-1 min-w-0 overflow-y-auto pb-16 md:pb-0">{children}</main>

      <MobileNavAuction />

      <Toaster />
    </div>
  );
}
