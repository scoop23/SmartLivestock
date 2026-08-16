"use client";

import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { Toaster } from "sonner";

export default function SibatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar
        role="sibat"
        onLogout={() => router.push("/")}
      />

      <main className="flex-1 overflow-auto">{children}</main>

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
