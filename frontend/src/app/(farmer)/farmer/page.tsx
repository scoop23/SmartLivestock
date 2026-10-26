"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ValidationLoadingScreen, useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import {
  ArrowUpRight,
  Barcode,
  CalendarDays,
  Clock,
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

  // Live real-time clock updating every second
  const [clockString, setClockString] = useState<string>("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const updateTime = () => {
      setClockString(`${formatter.format(new Date())} PHT`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const startDashboardTour = useCallback(() => {
    const hasDesktopSidebar = window.matchMedia("(min-width: 1024px)").matches;
    const shouldPinSidebar = hasDesktopSidebar && getAutomaticTutorialsEnabled();
    if (shouldPinSidebar) {
      window.dispatchEvent(
        new CustomEvent("smartlivestock:farmer-dashboard-tour-sidebar", {
          detail: { active: true },
        })
      );
    }

    const sidebarSteps = hasDesktopSidebar
      ? [
          {
            element: '[data-tour="farmer-sidebar-pin"]',
            popover: {
              title: "Sidebar pinned for this guide",
              description:
                "The sidebar is expanded during the walkthrough so each navigation label is visible. Its previous pinned state will be restored when the guide ends.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-farmer"]',
            popover: {
              title: "Home",
              description:
                "Return to the Farmer dashboard for a summary of your farm and recent updates.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-livestock-inventory"]',
            popover: {
              title: "Livestock",
              description:
                "Open your inventory to view animals, check review status, or manage livestock details.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-production-dashboard"]',
            popover: {
              title: "Production",
              description:
                "Record farm activities and review production, birth, weight, and sale-intent records.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-report-observation"]',
            popover: {
              title: "Report",
              description:
                "Submit a disease or mortality observation to the livestock office.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-gis-user-map"]',
            popover: {
              title: "GIS Mapping",
              description:
                "Open the farm map and its available livestock and location information.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-farmer-scheduling"]',
            popover: {
              title: "Programs",
              description:
                "View agriculture programs and scheduled farm visits.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-farmer-announcement"]',
            popover: {
              title: "Announcement",
              description:
                "Read updates and notices from the agriculture office.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-help"]',
            popover: {
              title: "Help & Support",
              description:
                "Find contact information and quick guidance for using SmartLivestock.",
              side: "right" as const,
              align: "center" as const,
            },
          },
          {
            element: '[data-tour="farmer-sidebar-profile"]',
            popover: {
              title: "Your account",
              description:
                "Open your account options and view your profile information.",
              side: "right" as const,
              align: "center" as const,
            },
          },
        ]
      : [];

    const runTour = () =>
      startGuidedTutorial({
        showProgress: true,
        animate: true,
        allowClose: true,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        progressText: "{{current}} of {{total}}",
        onDestroyed: () => {
          if (shouldPinSidebar) {
            window.dispatchEvent(
              new CustomEvent("smartlivestock:farmer-dashboard-tour-sidebar", {
                detail: { active: false },
              })
            );
          }
        },
        steps: [
          ...sidebarSteps,
          {
            element: '[data-tour="record-activity"]',
            popover: {
              title: "Record an activity",
              description:
                "Use this shortcut to record milk production, births, weights, and other farm activities.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="my-livestock"]',
            popover: {
              title: "My livestock",
              description:
                "Open your livestock records to find an animal or update its details.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="report-health"]',
            popover: {
              title: "Report an animal health issue",
              description:
                "Use this shortcut to notify the livestock office about a disease or other health concern.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="my-livestock-stat"]',
            popover: {
              title: "Livestock count",
              description:
                "See how many livestock are registered to your farm and whether any are still awaiting review.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="production-stat"]',
            popover: {
              title: "Production this month",
              description:
                "Check this month’s recorded milk production and its change from the previous month.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="health-stat"]',
            popover: {
              title: "Animal health reports",
              description:
                "Keep an eye on animal health reports that are waiting for review.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="record-status-stat"]',
            popover: {
              title: "Record status",
              description:
                "See how much of your livestock information has been reviewed by the livestock office.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="recent-activity"]',
            popover: {
              title: "Recent activity",
              description:
                "Follow updates to your submitted records and see whether they are pending, verified, or approved.",
              side: "top",
              align: "start",
            },
          },
          {
            element: '[data-tour="programs-visits"]',
            popover: {
              title: "Programs and visits",
              description:
                "Keep up with agriculture programs and scheduled farm visits.",
              side: "top",
              align: "start",
            },
          },
          {
            element: '[data-tour="farm-summary"]',
            popover: {
              title: "Farm summary and charts",
              description:
                "Open this section whenever you want to explore production trends, livestock breakdowns, and record status charts.",
              side: "top",
              align: "start",
            },
          },
          {
            element: '[data-tour="farm-services"]',
            popover: {
              title: "Farm services and links",
              description:
                "Expand this section to find Programs & Visits, the Farm Map, and Activities.",
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

  const municipalHerdId = user?.barangay
    ? `PG-${user.barangay.toUpperCase().slice(0, 3)}-${String(user.farmerId || 200).padStart(3, "0")}`
    : "PG-MAN-200";

  return (
    <>
      {/* Retain the original PageHeader without changing its green header styling */}
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
              className="h-11 rounded-xl bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25 hover:text-white sm:rounded-2xl cursor-pointer"
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

      {/* Upper Micro-Telemetry Banner with Live Realtime Clock (No Transmit Telemetry Button) */}
      <div className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-2 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              {/* <span className="tracking-wide uppercase">BIO-NODE // LIVESTOCK SENSORS SYNCHRONIZED</span> */}
            </div>
            <span className="hidden text-slate-300 md:inline">/</span>
            <div className="hidden items-center gap-1.5 font-semibold text-slate-600 md:flex">
              <Barcode className="size-3.5 text-emerald-600" />
              <span>
                MUNICIPAL HERD ID:{" "}
                <strong className="font-mono text-slate-900">{municipalHerdId}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/*<div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">*/}
              {/*<span className="size-1.5 rounded-full bg-emerald-500" />*/}
              {/* <span>RADIO TELEMETRY: 99.8% ONLINE</span> */}
            {/*</div>*/}
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
              <Clock className="size-3.5 text-slate-400" />
              <span className="tabular-nums font-bold">
                {clockString || "Loading Manila time…"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ambient Blueprint Viewport Container */}
      <div className="relative min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-7">
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
              {/* SECTION 1: QUICK ACTIONS ROW */}
              <section aria-label="Quick actions" className="space-y-2.5">
                <div>
                  <h2 className="text-base font-display font-bold tracking-tight text-slate-900">
                    Quick actions
                  </h2>
                  <p className="text-xs font-medium text-slate-500">
                    Common tasks for managing your farm
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Action 1: Record an activity */}
                  <button
                    type="button"
                    data-tour="record-activity"
                    onClick={() => router.push("/production-dashboard")}
                    className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-holo-card hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-transform group-hover:scale-105">
                      <Sparkles className="size-5 sm:size-6 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-display text-sm font-bold text-slate-900 transition-colors group-hover:text-emerald-700">
                          Record an activity
                        </h3>
                        <ArrowUpRight className="size-4 text-slate-300 transition-colors group-hover:text-emerald-600 shrink-0" />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                        Milk, birth, weight, and more
                      </p>
                    </div>
                  </button>

                  {/* Action 2: My livestock */}
                  <button
                    type="button"
                    data-tour="my-livestock"
                    onClick={() => router.push("/livestock-inventory")}
                    className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-holo-card hover:border-sky-400 hover:bg-sky-50/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 transition-transform group-hover:scale-105">
                      <MapPin className="size-5 sm:size-6 text-sky-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-display text-sm font-bold text-slate-900 transition-colors group-hover:text-sky-700">
                          My livestock
                        </h3>
                        <ArrowUpRight className="size-4 text-slate-300 transition-colors group-hover:text-sky-600 shrink-0" />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                        Find an animal or update its details
                      </p>
                    </div>
                  </button>

                  {/* Action 3: Report an animal health issue */}
                  <button
                    type="button"
                    data-tour="report-health"
                    onClick={() => router.push("/report-observation?newReport=DISEASE")}
                    className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-holo-card hover:border-amber-400 hover:bg-amber-50/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition-transform group-hover:scale-105">
                      <Stethoscope className="size-5 sm:size-6 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-display text-sm font-bold text-slate-900 transition-colors group-hover:text-amber-700">
                          Report an animal health issue
                        </h3>
                        <ArrowUpRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-600 shrink-0" />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                        Tell the livestock office what happened
                      </p>
                    </div>
                  </button>
                </div>
              </section>

              {/* SECTION 2: 4 ELEVATED KPI CARDS */}
              {isLoading ? (
                <FarmerStats isLoading />
              ) : isError ? (
                <Card className="p-8 text-center border-red-200 bg-red-50 rounded-3xl">
                  <h3 className="font-bold text-red-800 text-base">Unable to load farm analytics</h3>
                  <p className="text-xs text-red-600 mt-1">Please check your connection and try again.</p>
                  <Button
                    size="sm"
                    className="mt-4 bg-red-700 hover:bg-red-800 text-white rounded-xl gap-2 h-10 px-4 text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="size-4" /> Retry
                  </Button>
                </Card>
              ) : (
                <div data-tour="farm-stats">
                  <FarmerStats data={analytics} />
                </div>
              )}

              {/* SECTION 3: RECENT FARM ACTIVITY (Holographic Feed) */}
              <div data-tour="recent-activity">
                <FarmerActivityFeed
                  activities={analytics?.recent_activities}
                  isLoading={isLoading}
                />
              </div>

              {/* Programs and Visits */}
              <div data-tour="programs-visits">
                <FarmerProgramsVisits />
              </div>

              {/* Farm summary and charts (Collapsible) */}
              <details
                data-tour="farm-summary"
                className="group rounded-3xl border border-slate-200/90 bg-white p-5 shadow-holo-card"
              >
                <summary className="cursor-pointer list-none rounded-lg font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display font-bold text-base sm:text-lg">
                      Farm summary and charts
                    </span>
                    <span className="text-sm font-medium text-emerald-800 group-open:hidden">
                      View
                    </span>
                    <span className="hidden text-sm font-medium text-emerald-800 group-open:inline">
                      Hide
                    </span>
                  </span>
                  <span className="mt-1 block text-sm font-normal text-slate-600">
                    Production trends, livestock breakdown, and record status.
                  </span>
                </summary>
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <FarmerCharts data={analytics} isLoading={isLoading} />
                </div>
              </details>

              {/* Farm services and links (Collapsible) */}
              <details
                data-tour="farm-services"
                className="group rounded-3xl border border-slate-200/90 bg-slate-50/80 p-4 shadow-holo-card"
              >
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-sm font-bold">Farm services and links</span>
                  <span className="font-semibold text-emerald-800 group-open:hidden">Show</span>
                  <span className="hidden font-semibold text-emerald-800 group-open:inline">Hide</span>
                </summary>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <Sparkles className="size-4 text-[#2D5A27]" />
                    <span>Farm Services</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => router.push("/farmer-scheduling")}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs text-[11px]"
                    >
                      <CalendarDays className="size-3.5 text-indigo-600" />
                      <span>Programs & Visits</span>
                    </button>

                    <button
                      onClick={() => router.push("/gis-user-map")}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs text-[11px]"
                    >
                      <Map className="size-3.5 text-teal-600" />
                      <span>Farm Map</span>
                    </button>

                    <button
                      onClick={() => router.push("/farmer-announcement")}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs text-[11px]"
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
