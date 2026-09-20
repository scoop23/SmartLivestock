"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/components/page-header";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import {
  Package,
  Bell,
  Plus,
  Stethoscope,
  RefreshCw,
  CalendarDays,
  Map,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import FarmerStats from "./farmer-stats";
import FarmerCharts from "./farmer-charts";
import FarmerActivityFeed from "./farmer-activity-feed";
import { useFarmerDashboardAnalytics } from "./farmer-analytics";

export default function FarmerDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useFarmerDashboardAnalytics();

  const farmerName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "Farmer";

  return (
    <>
      <PageHeader
        title={`Welcome, ${farmerName}!`}
        subtitle="Padre Garcia, Batangas — Municipal Livestock Management Portal"
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={`size-4.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/alerts")}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title="View Alerts & Advisories"
            >
              <Bell className="size-4.5" />
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {/* 1. KEY EXECUTIVE METRICS */}
        {isLoading ? (
          <FarmerStats isLoading />
        ) : isError ? (
          <Card className="p-8 text-center border-red-200 bg-red-50 rounded-3xl">
            <h3 className="font-bold text-red-800 text-base">
              Unable to load farm analytics
            </h3>
            <p className="text-xs text-red-600 mt-1">
              Please check your connection and try again.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-red-700 hover:bg-red-800 text-white rounded-xl gap-1.5"
              onClick={() => refetch()}
            >
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </Card>
        ) : (
          <FarmerStats data={analytics} />
        )}

        {/* 2. QUICK ACTIONS HUB */}
        <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl overflow-hidden">
          <CardContent className="p-5">
            <h3 className="text-base font-black text-emerald-950 mb-4 flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-100/80 text-emerald-900">
                <Icon iconNode={cowHead} className="size-4" />
              </div>
              Farmer Quick Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <button
                onClick={() => router.push("/livestock-inventory")}
                className="group flex flex-col items-center gap-2.5 p-4 bg-emerald-50/40 rounded-2xl border-2 border-transparent hover:border-emerald-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer text-center"
              >
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-emerald-900/10 group-hover:scale-110 transition-transform">
                  <Plus className="size-5 text-emerald-800" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                  Register Animal
                </span>
              </button>

              <button
                onClick={() => router.push("/production-dashboard")}
                className="group flex flex-col items-center gap-2.5 p-4 bg-sky-50/40 rounded-2xl border-2 border-transparent hover:border-sky-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer text-center"
              >
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-sky-900/10 group-hover:scale-110 transition-transform">
                  <Package className="size-5 text-sky-800" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-sky-950">
                  Log Production
                </span>
              </button>

              <button
                onClick={() => router.push("/report-observation")}
                className="group flex flex-col items-center gap-2.5 p-4 bg-amber-50/40 rounded-2xl border-2 border-transparent hover:border-amber-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer text-center"
              >
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-amber-900/10 group-hover:scale-110 transition-transform">
                  <Stethoscope className="size-5 text-amber-800" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                  Report Sickness
                </span>
              </button>

              <button
                onClick={() => router.push("/farmer-scheduling")}
                className="group flex flex-col items-center gap-2.5 p-4 bg-indigo-50/40 rounded-2xl border-2 border-transparent hover:border-indigo-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer text-center"
              >
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-indigo-900/10 group-hover:scale-110 transition-transform">
                  <CalendarDays className="size-5 text-indigo-800" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                  MAO Programs
                </span>
              </button>

              <button
                onClick={() => router.push("/gis-user-map")}
                className="group flex flex-col items-center gap-2.5 p-4 bg-teal-50/40 rounded-2xl border-2 border-transparent hover:border-teal-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer text-center"
              >
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-teal-900/10 group-hover:scale-110 transition-transform">
                  <Map className="size-5 text-teal-800" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-teal-950">
                  Pasture GIS Map
                </span>
              </button>

              <button
                onClick={() => router.push("/farmer-announcement")}
                className="group flex flex-col items-center gap-2.5 p-4 bg-rose-50/40 rounded-2xl border-2 border-transparent hover:border-rose-700/40 hover:bg-white hover:shadow-md transition-all cursor-pointer text-center"
              >
                <div className="p-3 bg-white rounded-2xl shadow-2xs border border-rose-900/10 group-hover:scale-110 transition-transform">
                  <Megaphone className="size-5 text-rose-800" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-rose-950">
                  Announcements
                </span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 3. VISUALIZATION & CHARTS MATRIX */}
        <FarmerCharts data={analytics} isLoading={isLoading} />

        {/* 4. LIVE FARM ACTIVITY & REVIEW STATUS FEED */}
        <FarmerActivityFeed
          activities={analytics?.recent_activities}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}
