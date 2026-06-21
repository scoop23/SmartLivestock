"use client"; // Required for useState and useRouter in Next.js App Router

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, Shield, CheckCircle, AlertCircle, Clock, Send } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "../components/sidebar";
import MobileNav from "../components/mobilenav";
import MobileNavSibat from "../components/mobilenavsibat";

export default function SibatPortal() {
  const router = useRouter();
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);

  const pendingRecords = [
    { id: 1, farmer: "Juan Dela Cruz", type: "Mortality Report", breed: "Brahman Bull", count: 1, date: "2026-04-25", status: "pending" },
    { id: 2, farmer: "Maria Santos", type: "Production Update", breed: "Holstein-Friesian", count: 3, date: "2026-04-25", status: "pending" },
    { id: 3, farmer: "Pedro Reyes", type: "Disease Report", breed: "Native Cattle", count: 2, date: "2026-04-24", status: "pending" },
    { id: 4, farmer: "Rosa Garcia", type: "Slaughter Record", breed: "Crossbreed", count: 1, date: "2026-04-24", status: "pending" },
  ];

  const validatedRecords = [
    { id: 5, farmer: "Antonio Cruz", type: "Inventory Update", breed: "Brahman", count: 5, date: "2026-04-23", status: "validated" },
    { id: 6, farmer: "Luz Mendoza", type: "Production Update", breed: "Holstein-Friesian", count: 2, date: "2026-04-22", status: "validated" },
  ];

  const toggleRecord = (id: number) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="sibat" onLogout={() => router.push('/')} />
      </div>
      {/* Header */}
      <main className="flex flex-col w-full">
      <header className="bg-[#1A365D] text-white shadow-lg sticky top-0 z-20 flex">
        
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Replaced navigate() with Next.js Link */}
              <Link
                href="/"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Home className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold">SmartLivestock-Batangas</h1>
                <p className="text-sm text-white/80"> SIBAT/Cooperative Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              
              <div className="text-right">
                <p className="text-sm font-semibold"> SIBAT Cooperative</p>
                <p className="text-xs text-white/70">Padre Garcia, Batangas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Barangay Lockdown Indicator */}
      <div className="bg-[#FFBF00] border-l-4 border-[#2D5A27] px-6 py-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-gray-900" />
          <div>
            <p className="font-bold text-gray-900">
              Barangay Lockdown Active - Viewing: Brgy. Lipay Only
            </p>
            <p className="text-sm text-gray-800">
              Data filtered strictly for your assigned sector | San Jose Municipality
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">4</p>
            <p className="text-sm text-gray-600">Pending Validation</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">2</p>
            <p className="text-sm text-gray-600">Validated Today</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">12</p>
            <p className="text-sm text-gray-600">Sent to MAO</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">1</p>
            <p className="text-sm text-gray-600">Flagged Issues</p>
          </div>
        </div>

        {/* Pending Validation Table */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-gray-900">
              Pending Data Validation
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRecords(pendingRecords.map((r) => r.id))}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Select All
              </button>
              <button
                disabled={selectedRecords.length === 0}
                className="px-4 py-2 text-sm bg-[#2D5A27] text-white rounded-lg hover:bg-[#234520] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Validate Selected ({selectedRecords.length})
              </button>
              <button
                disabled={selectedRecords.length === 0}
                className="px-4 py-2 text-sm bg-[#1A365D] text-white rounded-lg hover:bg-[#152944] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Push to MAO
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 cursor-pointer"
                      checked={selectedRecords.length === pendingRecords.length}
                      onChange={() =>
                        selectedRecords.length === pendingRecords.length
                          ? setSelectedRecords([])
                          : setSelectedRecords(pendingRecords.map((r) => r.id))
                      }
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Farmer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Breed</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Count</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRecords.map((record) => (
                  <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={selectedRecords.includes(record.id)}
                        onChange={() => toggleRecord(record.id)}
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{record.farmer}</td>
                    <td className="py-3 px-4 text-gray-700">{record.type}</td>
                    <td className="py-3 px-4 text-gray-700">{record.breed}</td>
                    <td className="py-3 px-4 text-gray-700">{record.count}</td>
                    <td className="py-3 px-4 text-gray-700">{record.date}</td>
                    <td className="py-3 px-4">
                      <button className="text-[#2D5A27] hover:underline text-sm font-semibold">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit History */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Audit History - Validated Records
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Farmer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Breed</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Count</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {validatedRecords.map((record) => (
                  <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900">{record.farmer}</td>
                    <td className="py-3 px-4 text-gray-700">{record.type}</td>
                    <td className="py-3 px-4 text-gray-700">{record.breed}</td>
                    <td className="py-3 px-4 text-gray-700">{record.count}</td>
                    <td className="py-3 px-4 text-gray-700">{record.date}</td>
                    <td className="py-3 px-4">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        VALIDATED
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
      <MobileNavSibat />
    </div>
    
  );
}