"use client";

import { useRouter } from "next/navigation";
import MobileNav from "@/app/components/mobilenav";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "sonner";

export default function FarmerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-900 antialiased">
      <div className="hidden md:block">
        <Sidebar
          role="farmer"
          onLogout={() => router.push("/")}
        />
      </div>

      <main className="flex-1 overflow-auto">{children}</main>

      <MobileNav />

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
