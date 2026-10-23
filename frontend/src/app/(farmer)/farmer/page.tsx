"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ValidationLoadingScreen,useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import {
CalendarDays,
Map,
MapPin,
Megaphone,
RefreshCw,
Sparkles,
Stethoscope,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import FarmerReportsListDialog from "../components/farmer-reports-list-dialog";
import ReportDetailDialog from "../report-observation/components/report-detail-dialog";
import ReportIllnessDialog from "../report-observation/components/report-illness-dialog";
import { FarmerReport } from "../report-observation/report-observation-types";
import FarmerProgramsVisits from "./components/farmer-programs-visits";
import FarmerActivityFeed from "./farmer-activity-feed";
import { useFarmerDashboardAnalytics } from "./farmer-analytics";
import FarmerCharts from "./farmer-charts";
import FarmerStats from "./farmer-stats";

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
  const keepLoadingScreenMounted = useLoadingScreenTransition(isLoading);

  const startDashboardTour = useCallback(() => {
    const hasDesktopSidebar = window.matchMedia("(min-width: 1024px)").matches;
    const shouldPinSidebar = hasDesktopSidebar && getAutomaticTutorialsEnabled();
    if (shouldPinSidebar) {
      window.dispatchEvent(new CustomEvent("smartlivestock:farmer-dashboard-tour-sidebar", { detail: { active: true } }));
    }

    const sidebarSteps = hasDesktopSidebar
      ? [
          { element: '[data-tour="farmer-sidebar-pin"]', popover: { title: "Sidebar pinned for this guide", description: "The sidebar is expanded during the walkthrough so each navigation label is visible. Its previous pinned state will be restored when the guide ends.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-farmer"]', popover: { title: "Home", description: "Return to the Farmer dashboard for a summary of your farm and recent updates.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-livestock-inventory"]', popover: { title: "Livestock", description: "Open your inventory to view animals, check review status, or manage livestock details.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-production-dashboard"]', popover: { title: "Production", description: "Record farm activities and review production, birth, weight, and sale-intent records.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-report-observation"]', popover: { title: "Report", description: "Submit a disease or mortality observation to the livestock office.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-gis-user-map"]', popover: { title: "GIS Mapping", description: "Open the farm map and its available livestock and location information.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-farmer-scheduling"]', popover: { title: "Programs", description: "View agriculture programs and scheduled farm visits.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-farmer-announcement"]', popover: { title: "Announcement", description: "Read updates and notices from the agriculture office.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-help"]', popover: { title: "Help & Support", description: "Find contact information and quick guidance for using SmartLivestock.", side: "right" as const, align: "center" as const } },
          { element: '[data-tour="farmer-sidebar-profile"]', popover: { title: "Your account", description: "Open your account options and view your profile information.", side: "right" as const, align: "center" as const } },
        ]
      : [];

    const runTour = () => startGuidedTutorial({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}",
      onDestroyed: () => {
        if (shouldPinSidebar) {
          window.dispatchEvent(new CustomEvent("smartlivestock:farmer-dashboard-tour-sidebar", { detail: { active: false } }));
        }
      },
      steps: [
        ...sidebarSteps,
        {
          element: '[data-tour="record-activity"]',
          popover: {
            title: "Record an activity",
            description: "Use this shortcut to record milk production, births, weights, and other farm activities.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="my-livestock"]',
          popover: {
            title: "My livestock",
            description: "Open your livestock records to find an animal or update its details.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="report-health"]',
          popover: {
            title: "Report an animal health issue",
            description: "Use this shortcut to notify the livestock office about a disease or other health concern.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="my-livestock-stat"]',
          popover: {
            title: "Livestock count",
            description: "See how many livestock are registered to your farm and whether any are still awaiting review.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="production-stat"]',
          popover: {
            title: "Production this month",
            description: "Check this month’s recorded milk production and its change from the previous month.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="health-stat"]',
          popover: {
            title: "Animal health reports",
            description: "Keep an eye on animal health reports that are waiting for review.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="record-status-stat"]',
          popover: {
            title: "Record status",
            description: "See how much of your livestock information has been reviewed by the livestock office.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="recent-activity"]',
          popover: {
            title: "Recent activity",
            description: "Follow updates to your submitted records and see whether they are pending, verified, or approved.",
            side: "top",
            align: "start",
          },
        },
        {
          element: '[data-tour="programs-visits"]',
          popover: {
            title: "Programs and visits",
            description: "Keep up with agriculture programs and scheduled farm visits.",
            side: "top",
            align: "start",
          },
        },
        {
          element: '[data-tour="farm-summary"]',
          popover: {
            title: "Farm summary and charts",
            description: "Open this section whenever you want to explore production trends, livestock breakdowns, and record status charts.",
            side: "top",
            align: "start",
          },
        },
        {
          element: '[data-tour="farm-services"]',
          popover: {
            title: "Farm services and links",
            description: "Expand this section to find Programs & Visits, the Farm Map, and Activities.",
            side: "top",
            align: "start",
          },
        },
      ],
    });

    if (shouldPinSidebar) window.setTimeout(runTour, 250);
    else runTour();
  }, []);

  useEffect(() => {
    if (isLoading || keepLoadingScreenMounted || isError) return;
    if (!getAutomaticTutorialsEnabled()) return;

    const timer = window.setTimeout(startDashboardTour, 600);

    return () => window.clearTimeout(timer);
  }, [isLoading, keepLoadingScreenMounted, isError, startDashboardTour]);

  // ── Dialog States ──
  const [isReportIllnessOpen, setIsReportIllnessOpen] = useState(false);
  const [reportIllnessDefaultType, setReportIllnessDefaultType] = useState<"DISEASE" | "MORTALITY">("DISEASE");
  const [isReportsListOpen, setIsReportsListOpen] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<FarmerReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const farmerName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "Farmer";

  // Dynamic greeting based on current local hour
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good Morning"
      : currentHour < 18
      ? "Good Afternoon"
      : "Good Evening";

  // Handle opening illness dialog with specific default type
  const handleOpenReportIllness = (defaultType: "DISEASE" | "MORTALITY" = "DISEASE") => {
    setReportIllnessDefaultType(defaultType);
    setIsReportIllnessOpen(true);
  };

  return (
    <>
      <PageHeader
        title={`${greeting}, ${farmerName}!`}
        subtitle="Your livestock, farm records, and updates in one place."
        variant="farmer"
        maxWidthClass="w-full"
        mobileActionsRow
        action={
          <>
            {user?.barangay ? (
              <span
                className="inline-flex items-center gap-1.5 h-11 max-w-[38vw] sm:max-w-none px-2.5 sm:px-3 rounded-xl bg-white/15 border border-white/20 text-white text-[11px] sm:text-xs font-bold backdrop-blur-xs shadow-xs min-w-0"
                title="Your registered barangay"
              >
                <MapPin className="size-4 shrink-0" />
                <span className="truncate">Brgy. {user.barangay}</span>
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={startDashboardTour}
              className="h-11 rounded-xl bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25 hover:text-white sm:rounded-2xl"
              aria-label="Start farmer dashboard tutorial"
            >
              <Sparkles className="mr-1.5 size-4" />
              Tutorial
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {isLoading || keepLoadingScreenMounted ? (
          <ValidationLoadingScreen
            isLoading={isLoading}
            title="Loading Your Farmer Dashboard"
            subtitle="Gathering your livestock, production, health, and recent record updates..."
            badgeLabel="Farmer Dashboard Sync"
            authorityText="SmartLivestock · Padre Garcia, Batangas"
            items={[
              {
                id: "farmer-dashboard",
                label: "Your Farm Overview",
                sublabel: "Livestock, production, health, and recent activity",
                loaded: !isLoading,
              },
            ]}
          />
        ) : (
          <>
        <section aria-label="Quick actions" className="space-y-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Quick actions</h2>
            <p className="mt-0.5 text-sm text-slate-600">Common tasks for managing your farm</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <button type="button" data-tour="record-activity" onClick={() => router.push("/production-dashboard")} className="flex min-h-24 min-w-0 items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-left shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><Sparkles className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-snug text-slate-900 sm:text-base">Record an activity</span><span className="mt-1 block break-words text-sm leading-snug text-slate-600">Milk, birth, weight, and more</span></span>
            </button>
            <button type="button" data-tour="my-livestock" onClick={() => router.push("/livestock-inventory")} className="flex min-h-24 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-emerald-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MapPin className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-snug text-slate-900 sm:text-base">My livestock</span><span className="mt-1 block break-words text-sm leading-snug text-slate-600">Find an animal or update its details</span></span>
            </button>
            <button type="button" data-tour="report-health" onClick={() => router.push("/report-observation?newReport=DISEASE")} className="flex min-h-24 min-w-0 items-center gap-3 rounded-2xl border border-amber-200 bg-white p-4 text-left shadow-xs transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Stethoscope className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-snug text-slate-900 sm:text-base">Report an animal health issue</span><span className="mt-1 block break-words text-sm leading-snug text-slate-600">Tell the livestock office what happened</span></span>
            </button>
          </div>
        </section>

        {/* Important record-review work stays visible; only the detailed chart matrix moves behind a request. */}
        {isLoading ? (
          <FarmerStats isLoading />
        ) : isError ? (
          <Card className="p-8 text-center border-red-200 bg-red-50 rounded-3xl">
            <h3 className="font-bold text-red-800 text-base">Unable to load farm analytics</h3>
            <p className="text-xs text-red-600 mt-1">Please check your connection and try again.</p>
            <Button size="sm" className="mt-4 bg-red-700 hover:bg-red-800 text-white rounded-xl gap-2 h-10 px-4 text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer" onClick={() => refetch()}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </Card>
        ) : (
        <div data-tour="farm-stats"><FarmerStats data={analytics} /></div>
        )}

        <div data-tour="recent-activity">
          <FarmerActivityFeed
            activities={analytics?.recent_activities}
            isLoading={isLoading}
          />
        </div>

        <div data-tour="programs-visits"><FarmerProgramsVisits /></div>

        <details data-tour="farm-summary" className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <summary className="cursor-pointer list-none rounded-lg font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3"><span>Farm summary and charts</span><span className="text-sm font-medium text-emerald-800 group-open:hidden">View</span><span className="hidden text-sm font-medium text-emerald-800 group-open:inline">Hide</span></span>
            <span className="mt-1 block text-sm font-normal text-slate-600">Production trends, livestock breakdown, and record status.</span>
          </summary>
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <FarmerCharts data={analytics} isLoading={isLoading} />
          </div>
        </details>

        <details data-tour="farm-services" className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 [&::-webkit-details-marker]:hidden">
            <span>Farm services and links</span>
            <span className="font-semibold text-emerald-800 group-open:hidden">Show</span><span className="hidden font-semibold text-emerald-800 group-open:inline">Hide</span>
          </summary>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Sparkles className="size-4 text-[#2D5A27]" />
            <span>Farm Services</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/farmer-scheduling")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <CalendarDays className="size-3.5 text-indigo-600" />
              <span>Programs & Visits</span>
            </button>

            <button
              onClick={() => router.push("/gis-user-map")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <Map className="size-3.5 text-teal-600" />
              <span>Farm Map</span>
            </button>

            <button
              onClick={() => router.push("/farmer-announcement")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <Megaphone className="size-3.5 text-amber-600" />
              <span>Activities</span>
            </button>
          </div>
          </div>
        </details>
          </>
        )}
      </div>

      {/* ── MODAL DIALOGS ── */}

      <ReportIllnessDialog
        open={isReportIllnessOpen}
        onOpenChange={setIsReportIllnessOpen}
        defaultType={reportIllnessDefaultType}
        onSuccess={() => refetch()}
      />

      <FarmerReportsListDialog
        open={isReportsListOpen}
        onOpenChange={setIsReportsListOpen}
        onSelectReport={(rep) => {
          setSelectedReportDetail(rep);
          setIsDetailOpen(true);
        }}
        onOpenNewReport={() => handleOpenReportIllness("DISEASE")}
      />

      <ReportDetailDialog
        report={selectedReportDetail}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </>
  );
}
