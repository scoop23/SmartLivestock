"use client";

import { useRouter } from "next/navigation";
import { ClipboardCheck, CheckCircle, AlertCircle, Clock, Send } from "lucide-react";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import MobileNavAuction from "@/app/components/mobilenavauction";

export default function AuctionDashboard() {
  const router = useRouter();

  const recentInspections = [
    { id: 1, shipper: "Juan Dela Cruz", destination: "Batangas City Slaughterhouse", purpose: "Slaughter", date: "2026-04-25", status: "PENDING" },
    { id: 2, shipper: "Maria Santos", destination: "Lipa Breeding Center", purpose: "Breeding", date: "2026-04-24", status: "VERIFIED" },
    { id: 3, shipper: "Pedro Reyes", destination: "Tanauan Fattening Yard", purpose: "Fattening", date: "2026-04-24", status: "APPROVED" },
    { id: 4, shipper: "Rosa Garcia", destination: "Batangas City Slaughterhouse", purpose: "Slaughter", date: "2026-04-23", status: "REJECTED" },
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-700";
      case "VERIFIED": return "bg-blue-100 text-blue-700";
      case "APPROVED": return "bg-green-100 text-green-700";
      case "REJECTED": return "bg-red-100 text-red-700";
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
          title="SmartLivestock-Batangas"
          subtitle="Auction Staff Portal"
          variant="auction"
          sticky
          mobileMenuOffset={false}
          action={
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold">Auction Staff</p>
              <p className="text-xs text-white/70">Padre Garcia, Batangas</p>
            </div>
          }
        />

        <div className="px-6 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">8</p>
              <p className="text-sm text-gray-600">Pending Inspections</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">5</p>
              <p className="text-sm text-gray-600">Verified Today</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">12</p>
              <p className="text-sm text-gray-600">Approved This Week</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">2</p>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push("/auction-inspections")}
              className="bg-white rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-[#7C3AED] p-3 rounded-xl text-white group-hover:scale-105 transition-transform">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">New Inspection</p>
                  <p className="text-sm text-gray-500">Create a livestock inspection record</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => router.push("/auction-inspections")}
              className="bg-white rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-[#1A365D] p-3 rounded-xl text-white group-hover:scale-105 transition-transform">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">View Inspections</p>
                  <p className="text-sm text-gray-500">Review all inspection records</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => router.push("/auction-announcement")}
              className="bg-white rounded-xl shadow-lg p-6 text-left hover:shadow-xl transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-[#2D5A27] p-3 rounded-xl text-white group-hover:scale-105 transition-transform">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Announcements</p>
                  <p className="text-sm text-gray-500">View latest updates and news</p>
                </div>
              </div>
            </button>
          </div>

          {/* Recent Inspections */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Inspections</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Shipper</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Destination</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Purpose</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInspections.map((record) => (
                    <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{record.shipper}</td>
                      <td className="py-3 px-4 text-gray-700">{record.destination}</td>
                      <td className="py-3 px-4 text-gray-700">{record.purpose}</td>
                      <td className="py-3 px-4 text-gray-700">{record.date}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <MobileNavAuction />
    </div>
  );
}
