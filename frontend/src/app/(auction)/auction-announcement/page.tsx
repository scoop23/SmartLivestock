"use client";

import { useRouter } from "next/navigation";
import { Bell, Calendar, Tag } from "lucide-react";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import MobileNavAuction from "@/app/components/mobilenavauction";

export default function AuctionAnnouncement() {
  const router = useRouter();

  const announcements = [
    {
      id: 1,
      title: "New Inspection Protocol Effective May 1, 2026",
      date: "2026-04-20",
      category: "Policy",
      content: "All livestock inspections must now include a veterinary health certificate. Please ensure all required documents are prepared before scheduling an inspection.",
    },
    {
      id: 2,
      title: "Auction Schedule Update",
      date: "2026-04-18",
      category: "Schedule",
      content: "The weekly livestock auction will now be held every Wednesday and Saturday. All auction staff are required to be on-site by 6:00 AM.",
    },
    {
      id: 3,
      title: "System Maintenance Notice",
      date: "2026-04-15",
      category: "System",
      content: "SmartLivestock system will undergo maintenance on April 30, 2026 from 10:00 PM to 2:00 AM. Some features may be temporarily unavailable.",
    },
  ];

  const categoryColor = (category: string) => {
    switch (category) {
      case "Policy": return "bg-purple-100 text-purple-700";
      case "Schedule": return "bg-blue-100 text-blue-700";
      case "System": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="auction" onLogout={() => router.push("/")} />
      </div>
      <main className="flex flex-col w-full">
        <PageHeader
          title="Announcements"
          subtitle="Latest updates and news for auction staff"
          variant="auction"
          sticky
          mobileMenuOffset={false}
        />

        <div className="px-6 py-6 space-y-4">
          {announcements.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-[#7C3AED] p-2 rounded-lg text-white mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" /> {item.date}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryColor(item.category)}`}>
                        <Tag className="w-3 h-3" /> {item.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-3 leading-relaxed">{item.content}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <MobileNavAuction />
    </div>
  );
}
