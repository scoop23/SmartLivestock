"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";

export default function SlaughterhouseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || user.role?.toUpperCase() !== "SLAUGHTERHOUSESTAFF")) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="size-8 animate-spin rounded-full border-b-2 border-rose-600" /></div>;
  }
  if (!user || user.role?.toUpperCase() !== "SLAUGHTERHOUSESTAFF") return null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar role="slaughterhouse" onLogout={logout} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      <Toaster />
    </div>
  );
}
