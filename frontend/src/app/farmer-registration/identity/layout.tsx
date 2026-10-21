import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registration identity checks | SmartLivestock",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function IdentityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
