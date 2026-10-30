"use client";

import { ActivityPhotoCarousel } from "@/app/components/community/activity-photo-carousel";
import {
CommunityEmptyState,
CommunitySkeleton,
PROGRAM_TIME_SLOTS,
daysUntil,
formatLongDate,
formatTime,
isUpcoming,
} from "@/app/components/community/community-ui";
import { PageHeader } from "@/app/components/page-header";
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import api,{ getActiveApiUrl } from "@/lib/axios";
import {
ProgramBooking,
ProgramSchedule,
apiError,
getBookings,
getSchedules,
} from "@/lib/community-api";
import {
CalendarCheck,
CalendarDays,
CalendarPlus,
Check,
CheckCircle2,
ChevronLeft,
ChevronRight,
ClipboardList,
Clock,
Clock3,
CloudRain,
FileText,
GraduationCap,
HeartPulse,
Info,
Loader2,
MapPin,
Pencil,
Phone,
RefreshCw,
Sparkles,
Syringe,
Target,
Users,
X,
} from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense,useCallback,useEffect,useMemo,useState } from "react";

function localDateFromIso(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromLocalDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function programImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getActiveApiUrl().replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatShortDate(value: string | Date): string {
  const d = typeof value === "string" ? localDateFromIso(value) : value;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getProgramFallbackImage(category?: string | null, title?: string | null): string {
  const text = `${category || ""} ${title || ""}`.toUpperCase();
  if (text.includes("SWINE") || text.includes("PIG") || text.includes("BABOY")) return "/images/species-swine.jpg";
  if (text.includes("GOAT") || text.includes("KAMBING")) return "/images/species-goat.jpg";
  if (text.includes("CARABAO") || text.includes("KALABAW")) return "/images/species-carabao.jpg";
  return "/images/species-cattle.jpg";
}

function parseBulletPoints(text?: string | null, defaults: string[] = []): string[] {
  if (!text || !text.trim()) return defaults;
  const items = text
    .split(/[\n•\r]+/)
    .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : defaults;
}

function getProgramIcon(category: string) {
  const cat = category?.toUpperCase() || "";
  if (cat.includes("VACCIN") || cat.includes("INJECT")) {
    return <Syringe className="size-5 text-emerald-800" />;
  }
  if (cat.includes("DEWORM") || cat.includes("MEDIC")) {
    return <Sparkles className="size-5 text-emerald-800" />;
  }
  if (cat.includes("SEMINAR") || cat.includes("TRAIN")) {
    return <GraduationCap className="size-5 text-emerald-800" />;
  }
  if (cat.includes("CENSUS") || cat.includes("SURVEY")) {
    return <ClipboardList className="size-5 text-emerald-800" />;
  }
  return <HeartPulse className="size-5 text-emerald-800" />;
}

function FarmerSchedulingContent() {
  const searchParams = useSearchParams();
  const urlScheduleParam = searchParams.get("scheduleId") || searchParams.get("schedule");
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [detailsSchedule, setDetailsSchedule] = useState<ProgramSchedule | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bookingToast, setBookingToast] = useState("");
  const [bookingToastVisible, setBookingToastVisible] = useState(false);
  const [bookingToastClosing, setBookingToastClosing] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<"upcoming" | "past">("upcoming");
  const [highlightedBookingId, setHighlightedBookingId] = useState<number | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{
    photos: string[];
    alt: string;
    initialIndex: number;
  } | null>(null);
  const [cancelingTarget, setCancelingTarget] = useState<ProgramBooking | null>(null);
  const [editingBooking, setEditingBooking] = useState<ProgramBooking | null>(null);
  const [editTime, setEditTime] = useState("");

  const load = useCallback(async () => {
    try {
      const [open, mine] = await Promise.all([getSchedules(), getBookings()]);
      setSchedules(open);
      setBookings(mine);
      setError("");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsFetching(true);
    await load();
  }, [load]);

  useEffect(() => {
    // Loading state is updated after the external API requests finish.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!urlScheduleParam || schedules.length === 0) return;
    const target = schedules.find((s) => String(s.id) === String(urlScheduleParam));
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCalendarDate(localDateFromIso(target.date));
      setScheduleId(String(target.id));
      setDetailsSchedule(target);
      const frame = window.requestAnimationFrame(() => {
        const el = document.getElementById(`program-card-${target.id}`) || document.getElementById("program-details-section");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [urlScheduleParam, schedules]);

  useEffect(() => {
    if (
      highlightedBookingId === null ||
      !bookings.some((booking) => booking.id === highlightedBookingId)
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("my-bookings-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    const clearHighlight = window.setTimeout(() => setHighlightedBookingId(null), 6000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clearHighlight);
    };
  }, [bookings, highlightedBookingId]);

  useEffect(() => {
    if (!bookingToast) return;
    const timer = window.setTimeout(() => setBookingToastClosing(true), 4700);
    return () => window.clearTimeout(timer);
  }, [bookingToast]);

  useEffect(() => {
    if (!bookingToast || bookingToastClosing || bookingToastVisible) return;
    const frame = window.requestAnimationFrame(() => setBookingToastVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [bookingToast, bookingToastClosing, bookingToastVisible]);

  useEffect(() => {
    if (!bookingToastClosing) return;
    const timer = window.setTimeout(() => {
      setBookingToast("");
      setBookingToastClosing(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bookingToastClosing]);

  const selected = schedules.find((schedule) => schedule.id === Number(scheduleId));
  const datesWithPrograms = useMemo(() => new Set(schedules.map((schedule) => schedule.date)), [schedules]);
  const programsOnDate = useMemo(
    () => (calendarDate ? schedules.filter((schedule) => schedule.date === isoFromLocalDate(calendarDate)) : []),
    [calendarDate, schedules],
  );
  const confirmedScheduleIds = useMemo(
    () => new Set(bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.schedule)),
    [bookings],
  );
  const selectedAvailableTimes = selected?.available_times?.length ? selected.available_times : PROGRAM_TIME_SLOTS;
  const availableTimes = useMemo(() => (selected && (selected.capacity === 0 || selected.remaining_slots > 0) ? selectedAvailableTimes : []), [selected, selectedAvailableTimes]);

  async function book() {
    if (!scheduleId || !time || confirmedScheduleIds.has(Number(scheduleId))) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data: booking } = await api.post<ProgramBooking>("/community/bookings/", {
        schedule: Number(scheduleId),
        time,
      });
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setBookingToastClosing(false);
        setBookingToastVisible(false);
        setBookingToast(
          `${booking.program} on ${formatLongDate(booking.date)} at ${formatTime(booking.time)}.`,
        );
      }
      setMessage("Booking confirmed! Please arrive at the scheduled time.");
      setBookingFilter("upcoming");
      setHighlightedBookingId(booking.id);
      setScheduleId("");
      setTime("");
      setDetailsSchedule(null);
      window.history.replaceState({}, "", window.location.pathname);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmCancel() {
    if (!cancelingTarget) return;
    const targetId = cancelingTarget.id;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.patch(`/community/bookings/${targetId}/`, {
        status: "CANCELLED",
      });
      setMessage("Booking cancelled.");
      setCancelingTarget(null);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveBookingTime() {
    if (!editingBooking || !editTime) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.patch(`/community/bookings/${editingBooking.id}/`, { time: editTime });
      setMessage(`Your arrival time for ${editingBooking.program} has been updated.`);
      setEditingBooking(null);
      setEditTime("");
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const upcoming = confirmed.filter((b) => isUpcoming(b.date));
  const pastBookings = bookings.filter((booking) => booking.status !== "CONFIRMED" || !isUpcoming(booking.date));
  const nextVisit = useMemo(() => {
    const list = upcoming.slice().sort((a, b) => a.date.localeCompare(b.date));
    return list[0] ?? null;
  }, [upcoming]);

  const displayedBookings = useMemo(() => {
    const list = bookingFilter === "upcoming" ? upcoming : pastBookings;
    return list.slice().sort((a, b) => b.date.localeCompare(a.date));
  }, [bookingFilter, upcoming, pastBookings]);

  return (
    <>
      <PageHeader
        title="Livestock Programs"
        subtitle="Browse farmer programs, register for an activity, and manage your bookings."
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refresh()}
            disabled={isFetching}
            className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            title="Refresh schedules"
            aria-label="Refresh schedules"
          >
            <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out motion-reduce:animate-none">
        {/* Sleek Schedule Telemetry Ribbon (Replaces redundant KPI cards while clearly presenting all 3 insights) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:px-5 sm:py-3 shadow-xs md:flex-row md:items-center md:justify-between animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
          {/* Key Insight 1: Nearest Scheduled Farm Visit */}
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl ${
                nextVisit ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {nextVisit ? <Clock3 className="size-4.5 sm:size-5" /> : <CalendarCheck className="size-4.5 sm:size-5" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {nextVisit ? "Next Farm Visit" : "Field Appointments"}
                </span>
                {nextVisit ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950">
                    {daysUntil(nextVisit.date) === 0
                      ? "Today"
                      : daysUntil(nextVisit.date) === 1
                        ? "Tomorrow"
                        : `In ${daysUntil(nextVisit.date)} days`}
                  </span>
                ) : null}
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 whitespace-normal break-words">
                {nextVisit ? (
                  <>
                    <span>{nextVisit.program}</span>
                    <span className="text-slate-400 font-normal"> · </span>
                    <span className="text-emerald-800 font-bold">{formatLongDate(nextVisit.date)}</span>
                    <span className="text-slate-400 font-normal"> at </span>
                    <span className="text-slate-700 font-semibold">{formatTime(nextVisit.time)}</span>
                  </>
                ) : (
                  <span className="text-slate-600 font-medium">
                    No active appointments reserved · Pick an open program date below to book
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Key Insights 2 & 3: Interactive Status Badges */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 border-t border-slate-100 pt-2.5 md:border-t-0 md:pt-0">
            <button
              type="button"
              onClick={() => {
                setBookingFilter("upcoming");
                const el = document.getElementById("my-bookings-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 px-3 py-1.5 text-xs font-bold text-emerald-900 transition-colors cursor-pointer"
              title="View my upcoming bookings"
            >
              <CalendarCheck className="size-4 text-emerald-700" />
              <span>
                <strong>{upcoming.length}</strong> Reserved {upcoming.length === 1 ? "Slot" : "Slots"}
              </span>
            </button>

            <div
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-xs font-bold text-sky-900"
              title="Programs open across Padre Garcia"
            >
              <CalendarDays className="size-4 text-sky-700" />
              <span>
                <strong>{schedules.length}</strong> Open {schedules.length === 1 ? "Program" : "Programs"}
              </span>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {error ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-bold text-red-800 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-red-100 text-red-700">!</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-800 p-1"
              aria-label="Dismiss error"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm font-bold text-emerald-900 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
              <span>{message}</span>
            </div>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="text-emerald-700 hover:text-emerald-900 p-1"
              aria-label="Dismiss message"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {/* 2. Interactive Booking Suite */}
        <section aria-label="Book a program appointment" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
          <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            {/* Header & Guided Stepper */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 via-slate-50/30 to-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2.5 text-base sm:text-xl font-black text-slate-900 tracking-tight">
                    <CalendarPlus className="size-5 text-emerald-700" />
                    <span>Reserve an Appointment</span>
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                    Select a highlighted date, choose an active field program, and pick your arrival time window.
                  </p>
                </div>

                {/* Stepper Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                      calendarDate
                        ? "bg-emerald-100 text-emerald-900 font-black"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span>1. Date</span>
                    {calendarDate ? <Check className="size-3 text-emerald-700" /> : null}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                      selected
                        ? "bg-emerald-100 text-emerald-900 font-black"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span>2. Program</span>
                    {selected ? <Check className="size-3 text-emerald-700" /> : null}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                      time
                        ? "bg-emerald-800 text-white font-black shadow-xs"
                        : selected
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span>3. Time</span>
                  </span>
                </div>
              </div>
            </div>

            <CardContent className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
              {loading ? (
                <div className="lg:col-span-2">
                  <CommunitySkeleton cards={3} />
                </div>
              ) : schedules.length === 0 ? (
                <div className="lg:col-span-2 py-8">
                  <CommunityEmptyState
                    icon={<CalendarDays className="size-6" />}
                    title="No open program dates"
                    description="No municipal veterinary visits or programs are currently scheduled for booking. Please check back later."
                  />
                </div>
              ) : (
                <>
                  {/* Left Column: Interactive Calendar */}
                  <div className="flex flex-col space-y-3.5 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
                        1. Select Visit Date
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        {datesWithPrograms.size} Active Dates
                      </span>
                    </div>

                    <div className="flex flex-col items-stretch rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 md:p-4.5 shadow-2xs overflow-hidden min-w-0">
                      <Calendar
                        mode="single"
                        selected={calendarDate ?? undefined}
                        onSelect={(day) => {
                          setCalendarDate(day ?? null);
                          setScheduleId("");
                          setTime("");
                        }}
                        disabled={(day) => !datesWithPrograms.has(isoFromLocalDate(day))}
                        modifiers={{
                          programDate: schedules.map((schedule) => localDateFromIso(schedule.date)),
                        }}
                        modifiersClassNames={{
                          programDate:
                            "font-bold [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:-translate-x-1/2 [&>button]:after:size-1.5 [&>button]:after:rounded-full [&>button]:after:bg-emerald-600 [&>button]:after:content-[''] [&>button[data-selected-single=true]]:after:bg-white",
                        }}
                        className="w-full mx-auto [--cell-size:2.25rem] sm:[--cell-size:2.65rem] lg:[--cell-size:2.85rem] xl:[--cell-size:3.15rem]"
                        classNames={{
                          caption_label: "text-base sm:text-lg font-black text-slate-900",
                          weekday: "flex-1 min-w-0 text-center text-xs sm:text-sm font-bold text-slate-500 py-1.5",
                          day_button: "text-sm sm:text-base font-bold w-full h-auto aspect-square max-w-(--cell-size) max-h-(--cell-size) mx-auto",
                        }}
                      />

                      {/* Legend Bar */}
                      <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 px-2 text-xs font-medium text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-200" />
                          <span>Dates with programs</span>
                        </div>
                        {calendarDate ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCalendarDate(null);
                              setScheduleId("");
                              setTime("");
                            }}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            Clear date
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Municipal Guidelines & Veterinary Contacts Card */}
                    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3.5">
                      {/* Header */}
                      <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                          <Phone className="size-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                            Municipal Support & Guidelines
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Padre Garcia Municipal Agriculture Office (MAO)
                          </p>
                        </div>
                      </div>

                      {/* Hotlines Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-600" />
                            MAO Central Desk
                          </span>
                          <p className="text-xs font-black text-slate-900">(043) 515-2888</p>
                          <p className="text-[10px] text-slate-500">mao@padregarcia.gov.ph</p>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-amber-600" />
                            Biosecurity & Vet Desk
                          </span>
                          <p className="text-xs font-black text-slate-900">(043) 515-2889</p>
                          <p className="text-[10px] text-slate-500">Rapid animal health response</p>
                        </div>
                      </div>

                      {/* Weather Advisory Banner */}
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50/80 border border-sky-200/80 text-sky-950">
                        <CloudRain className="size-4 text-sky-700 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                          <strong className="font-bold block text-sky-900">Weather & Field Notice:</strong>
                          Outdoor visits and field vaccinations may be rescheduled during severe rainfall or weather advisories. Registered farmers will receive direct updates.
                        </div>
                      </div>

                      {/* Operating Hours Note */}
                      <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-slate-400" />
                          <span>Mon – Fri: 8:00 AM – 5:00 PM</span>
                        </div>
                        <span className="font-semibold text-slate-600">Poblacion, Padre Garcia</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Programs on Selected Date & Booking Form */}
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
                        {calendarDate ? `Programs on ${formatShortDate(calendarDate)}` : "2. Choose Field Program"}
                      </h3>
                      {calendarDate ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-600">
                          {programsOnDate.length} {programsOnDate.length === 1 ? "program" : "programs"}
                        </span>
                      ) : null}
                    </div>

                    {!calendarDate ? (
                      <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center">
                        <CalendarDays className="mx-auto size-8 text-emerald-600" />
                        <h4 className="mt-2 text-sm sm:text-base font-bold text-slate-800">Choose a date first</h4>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600">
                          Select a highlighted date on the calendar to see programs available in Padre Garcia.
                        </p>
                      </div>
                    ) : null}

                    {/* No programs on this date */}
                    {calendarDate && programsOnDate.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                        <CalendarDays className="mx-auto size-8 text-slate-300" />
                        <h4 className="mt-2 text-sm sm:text-base font-bold text-slate-700">No programs on this date</h4>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500">
                          Please pick one of the highlighted dates on the calendar to see available programs.
                        </p>
                      </div>
                    ) : null}

                    {/* Program Cards Grid */}
                    <div className={`grid gap-4 ${programsOnDate.length > 1 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
                      {programsOnDate.map((schedule) => {
                        const isUnlimited = schedule.capacity === 0;
                        const alreadyBooked = confirmedScheduleIds.has(schedule.id);
                        const isFull = !isUnlimited && (schedule.registration_status === "FULL" || (schedule.capacity > 0 && schedule.remaining_slots === 0));
                        const isClosed = !schedule.is_open || schedule.registration_status === "CLOSED" || schedule.registration_status === "NOT_OPEN" || schedule.registration_status === "CANCELLED" || schedule.registration_status === "COMPLETED";
                        const scheduleTimes = schedule.available_times?.length ? schedule.available_times : PROGRAM_TIME_SLOTS;

                        const programPhotos = [
                          ...(schedule.cover_image ? [programImageUrl(schedule.cover_image)] : []),
                          ...(schedule.photos ?? []).map((photo) => programImageUrl(photo.image)),
                        ];
                        const cardPhoto = programPhotos.length > 0
                          ? programPhotos[0]
                          : getProgramFallbackImage(schedule.category, schedule.program);
                        const displayPhotos = programPhotos.length > 0 ? programPhotos : [cardPhoto];

                        return (
                          <div
                            key={schedule.id}
                            id={`program-card-${schedule.id}`}
                            onClick={() => {
                              setScheduleId(String(schedule.id));
                              setDetailsSchedule(schedule);
                              setTime("");
                            }}
                            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-xs cursor-pointer space-y-4"
                          >
                            {/* Card Photo with proper padding */}
                            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-2xs">
                              <div className="h-44 w-full sm:h-52">
                                <ActivityPhotoCarousel
                                  photos={displayPhotos}
                                  alt={`${schedule.program} activity`}
                                  fit="contain"
                                  onImageClick={(initialIndex) =>
                                    setPhotoViewer({
                                      photos: displayPhotos,
                                      alt: `${schedule.program} activity`,
                                      initialIndex,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-3">
                              {/* Top Row: Category Icon & Badges */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0 border border-emerald-100/60">
                                  {getProgramIcon(schedule.category)}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-200 bg-emerald-50/80 text-emerald-900 font-bold text-xs capitalize"
                                  >
                                    {schedule.category.toLowerCase().replace(/_/g, " ")}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs font-bold uppercase tracking-wider ${
                                      isClosed
                                        ? "border-slate-200 bg-slate-100 text-slate-600"
                                        : isUnlimited
                                          ? "border-emerald-300 bg-emerald-100 text-emerald-950 font-black"
                                          : isFull
                                            ? "border-amber-200 bg-amber-50 text-amber-900"
                                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    }`}
                                  >
                                    {isClosed
                                      ? (schedule.registration_status === "NOT_OPEN" ? "OPENS SOON" : "CLOSED")
                                      : isUnlimited
                                        ? "OPEN WALK-IN"
                                        : alreadyBooked
                                          ? "BOOKED"
                                          : isFull
                                            ? "FULL"
                                            : "OPEN FOR REGISTRATION"}
                                  </Badge>
                                </div>
                              </div>

                              {/* Title */}
                              <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug transition-colors group-hover:text-emerald-800">
                                {schedule.program}
                              </h4>

                              {/* Key Schedule Information */}
                              <div className="space-y-1.5 text-xs sm:text-sm text-slate-600 font-medium">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="size-4 shrink-0 text-emerald-700" />
                                  <span className="font-semibold text-slate-800">{formatShortDate(schedule.date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock3 className="size-4 shrink-0 text-slate-400" />
                                  <span>
                                    {formatTime(scheduleTimes[0])} – {formatTime(scheduleTimes[scheduleTimes.length - 1])}
                                  </span>
                                </div>
                                {schedule.location ? (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="size-4 shrink-0 text-rose-500" />
                                    <span className="truncate">{schedule.location}</span>
                                  </div>
                                ) : null}
                                <div className="text-xs font-semibold text-slate-500 pt-0.5">
                                  {schedule.barangay_name ? `For ${schedule.barangay_name} farmers` : "Municipality-wide program"}
                                </div>
                              </div>
                            </div>

                            {/* View Details Button */}
                            <div className="pt-2">
                              <Button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScheduleId(String(schedule.id));
                                  setDetailsSchedule(schedule);
                                  setTime("");
                                }}
                                className="w-full h-10 rounded-xl bg-[#0F5A38] hover:bg-[#0c482d] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                              >
                                <span>View Details</span>
                                <ChevronRight className="size-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 3. My Bookings & Visit History Section */}
        <section id="my-bookings-section" aria-label="My scheduled bookings" className="scroll-mt-24 space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
          <Card className={`rounded-2xl border bg-white shadow-xs transition-all duration-500 ${
            highlightedBookingId !== null
              ? "border-emerald-400 ring-4 ring-emerald-200/70 shadow-md"
              : "border-slate-200"
          }`}>
            <CardHeader className={`p-4 sm:p-5 border-b border-slate-100 transition-colors duration-500 ${
              highlightedBookingId !== null ? "bg-emerald-50/70" : ""
            }`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2.5 text-base sm:text-xl font-black text-slate-900 tracking-tight">
                    <CalendarCheck className="size-5 text-emerald-700" />
                    <span>My Scheduled Programs</span>
                    {highlightedBookingId !== null ? (
                      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-900">
                        Booking confirmed
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-500 font-medium">
                    Review your upcoming confirmed reservations and complete appointment history.
                  </CardDescription>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={bookingFilter === "upcoming" ? "default" : "outline"}
                    onClick={() => setBookingFilter("upcoming")}
                    className={`h-9 rounded-full px-3.5 text-xs sm:text-sm font-bold transition-all ${
                      bookingFilter === "upcoming"
                        ? "bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>Upcoming</span>
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.2 text-xs font-black ${
                        bookingFilter === "upcoming"
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {upcoming.length}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={bookingFilter === "past" ? "default" : "outline"}
                    onClick={() => setBookingFilter("past")}
                    className={`h-9 rounded-full px-3.5 text-xs sm:text-sm font-bold transition-all ${
                      bookingFilter === "past"
                        ? "bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>Past Bookings</span>
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.2 text-xs font-black ${
                        bookingFilter === "past"
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {pastBookings.length}
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {loading ? (
                <CommunitySkeleton cards={2} />
              ) : displayedBookings.length === 0 ? (
                <div className="py-8">
                  <CommunityEmptyState
                    icon={<CalendarCheck className="size-6 text-slate-400" />}
                    title={bookingFilter === "upcoming" ? "No upcoming visits" : "No past bookings"}
                    description={
                      bookingFilter === "upcoming"
                        ? "You have no upcoming appointment slots reserved. Pick a program from the calendar above to book your visit."
                        : "Completed or cancelled program bookings will appear here."
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedBookings.map((booking) => {
                    const isConfirmed = booking.status === "CONFIRMED";
                    const isFuture = isUpcoming(booking.date);
                    const countdown = daysUntil(booking.date);
                    const canCancel = isConfirmed && isFuture;

                    return (
                      <Card
                        key={booking.id}
                        className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-4.5 shadow-xs transition-all ${
                          highlightedBookingId === booking.id
                            ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200 shadow-md"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="line-clamp-2 text-base font-black text-slate-900 tracking-tight">
                              {booking.program}
                            </h4>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-xs font-bold uppercase tracking-wider ${
                                isConfirmed
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-slate-200 bg-slate-100 text-slate-600"
                              }`}
                            >
                              {booking.status === "NO_SHOW" ? "No-show" : booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                            </Badge>
                          </div>
                          {highlightedBookingId === booking.id ? (
                            <Badge className="w-fit border-emerald-200 bg-emerald-100 text-emerald-900">
                              Just booked
                            </Badge>
                          ) : null}
                          {booking.program_status === "CANCELLED" ? <p className="text-xs font-bold text-rose-700">This program was cancelled.</p> : null}

                          {/* Date and Time Details */}
                          <div className="space-y-1.5 text-xs sm:text-sm text-slate-600 font-medium">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="size-4 shrink-0 text-emerald-700" />
                              <span className="font-semibold text-slate-800">
                                {formatLongDate(booking.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="size-4 shrink-0 text-slate-400" />
                              <span>{formatTime(booking.time)}</span>
                            </div>
                          </div>

                          {/* Countdown Indicator */}
                          {isConfirmed && isFuture ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200/80">
                              <Sparkles className="size-3.5 text-emerald-600" />
                              <span>
                                {countdown === 0
                                  ? "Scheduled for Today!"
                                  : countdown === 1
                                    ? "Scheduled for Tomorrow"
                                    : `In ${countdown} days`}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {/* Action Footer */}
                        {canCancel ? (
                          <div className="mt-4 flex flex-wrap justify-end gap-1.5 border-t border-slate-100 pt-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                setEditingBooking(booking);
                                setEditTime(booking.time.slice(0, 5));
                              }}
                              className="h-9 gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-bold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Pencil className="size-3.5" />
                              <span>Edit Time</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => setCancelingTarget(booking)}
                              className="h-8 gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                            >
                              <X className="size-3.5" />
                              <span>Cancel Reservation</span>
                            </Button>
                          </div>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
        </div>
      </div>

      {/* Program Activity Details Dialog Popup (Left design with picture on top) */}
      <Dialog
        open={detailsSchedule !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsSchedule(null);
          }
        }}
      >
        <DialogContent className="max-w-lg sm:max-w-xl md:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{detailsSchedule?.program || "Activity Details"}</DialogTitle>
            <DialogDescription>
              Detailed information and schedule for {detailsSchedule?.program}
            </DialogDescription>
          </DialogHeader>

          {detailsSchedule ? (
            <div className="space-y-4 sm:space-y-5">
              {/* Top Navigation */}
              <button
                type="button"
                onClick={() => setDetailsSchedule(null)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
                <span>Back to Field Program Schedule</span>
              </button>

              {(() => {
                const bannerPhoto = detailsSchedule.cover_image
                  ? programImageUrl(detailsSchedule.cover_image)
                  : (detailsSchedule.photos?.[0]?.image
                      ? programImageUrl(detailsSchedule.photos[0].image)
                      : getProgramFallbackImage(detailsSchedule.category, detailsSchedule.program));
                const programTimes = detailsSchedule.available_times?.length
                  ? detailsSchedule.available_times
                  : PROGRAM_TIME_SLOTS;
                const startTimeStr = formatTime(programTimes[0]);
                const endTimeStr = formatTime(programTimes[programTimes.length - 1]);
                const isUnlimited = detailsSchedule.capacity === 0;
                const isAlreadyBooked = confirmedScheduleIds.has(detailsSchedule.id);
                const isFull = !isUnlimited && (detailsSchedule.registration_status === "FULL" || (detailsSchedule.capacity > 0 && detailsSchedule.remaining_slots === 0));

                return (
                  <>
                    {/* Picture Hero Banner with Text Overlay (Screen 3 style) */}
                    <div className="relative h-56 sm:h-64 md:h-72 w-full overflow-hidden rounded-2xl bg-slate-900 shadow-md">
                      <Image
                        src={bannerPhoto}
                        alt={detailsSchedule.program}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />

                      <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5 text-white">
                        {/* Top Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#0F5A38] text-white font-bold text-xs px-3 py-1 shadow-xs border-0">
                            {detailsSchedule.barangay_name
                              ? `Barangay ${detailsSchedule.barangay_name} Program`
                              : "Open Municipal Program"}
                          </Badge>
                          <Badge variant="outline" className="border-white/40 bg-white/90 text-slate-900 font-bold text-xs px-3 py-1 shadow-xs backdrop-blur-xs">
                            {isUnlimited ? "No Registration Needed" : "Slot Reservation Available"}
                          </Badge>
                        </div>

                        {/* Title & Key details */}
                        <div className="space-y-1.5">
                          <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
                            {detailsSchedule.program}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm font-semibold text-slate-100">
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="size-4 text-emerald-400 shrink-0" />
                              {formatShortDate(detailsSchedule.date)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="size-4 text-emerald-400 shrink-0" />
                              {startTimeStr} – {endTimeStr}
                            </span>
                            {detailsSchedule.location ? (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="size-4 text-rose-400 shrink-0" />
                                {detailsSchedule.location}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Open Walk-in / Slot Callout Box */}
                    <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 sm:p-4.5 text-emerald-950">
                      <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-sm sm:text-base font-black text-emerald-950">
                          {isUnlimited
                            ? "Open Walk-in for All Eligible Farmers"
                            : "Guaranteed Slot Reservation Available"}
                        </h4>
                        <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed font-medium">
                          {isUnlimited
                            ? "You can attend directly at the venue during operating hours. No booking or reservation needed."
                            : "Reserve your preferred arrival time window below to guarantee priority service."}
                        </p>
                      </div>
                    </div>

                    {/* About this Program */}
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-emerald-700 shrink-0 mt-0.5">
                        <FileText className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">About this Program</h4>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                          {detailsSchedule.description ||
                            `Free vaccination for all cattle in Barangay Manggas. Help protect your livestock from common diseases.`}
                        </p>
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-emerald-700 shrink-0 mt-0.5">
                        <CalendarDays className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Date & Time</h4>
                        <p className="text-xs sm:text-sm text-slate-700 font-medium flex items-center gap-2">
                          <CalendarDays className="size-3.5 text-slate-400" />
                          <span>{formatShortDate(detailsSchedule.date)}</span>
                        </p>
                        <p className="text-xs sm:text-sm text-slate-500 font-normal flex items-center gap-2">
                          <Clock className="size-3.5 text-slate-400" />
                          <span>{startTimeStr} – {endTimeStr}</span>
                        </p>
                      </div>
                    </div>

                    {/* Venue / Location */}
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-emerald-700 shrink-0 mt-0.5">
                        <MapPin className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Venue / Location</h4>
                        <p className="text-xs sm:text-sm text-slate-800 font-semibold">{detailsSchedule.location || "Banaba Covered Court"}</p>
                        <p className="text-xs sm:text-sm text-slate-500 font-normal">
                          {detailsSchedule.barangay_name
                            ? `Designated for farmers of Barangay ${detailsSchedule.barangay_name}`
                            : "Designated for all registered livestock farmers in Padre Garcia"}
                        </p>
                      </div>
                    </div>

                    {/* 2-Column Objectives & Services Provided */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Objectives */}
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-emerald-700 shrink-0 mt-0.5">
                          <Target className="size-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">Objectives</h4>
                          <ul className="space-y-0.5 text-xs sm:text-sm text-slate-600 font-normal">
                            {parseBulletPoints(detailsSchedule.objectives, [
                              "Prevent common cattle diseases",
                              "Promote healthier livestock",
                            ]).map((bullet, idx) => (
                              <li key={idx}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Services Provided */}
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-emerald-700 shrink-0 mt-0.5">
                          <Sparkles className="size-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">Services Provided</h4>
                          <p className="text-xs sm:text-sm text-slate-600 font-normal">
                            Free {detailsSchedule.category.toLowerCase().replace(/_/g, " ")} vaccination
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Eligibility & Inquiries */}
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-emerald-700 shrink-0 mt-0.5">
                        <Users className="size-5" />
                      </div>
                      <div className="space-y-1.5 w-full">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Eligibility & Inquiries</h4>
                        <ul className="space-y-1 text-xs sm:text-sm text-slate-600 font-normal">
                          <li className="flex items-start gap-2">
                            <span className="text-slate-400 font-black">•</span>
                            <span>
                              {detailsSchedule.eligibility ||
                                (detailsSchedule.barangay_name
                                  ? `Open to all registered livestock farmers in Barangay ${detailsSchedule.barangay_name}.`
                                  : "Open to all registered livestock farmers in Padre Garcia.")}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-slate-400 font-black">•</span>
                            <span>
                              {detailsSchedule.contact_information
                                ? `For inquiries, contact: ${detailsSchedule.contact_information}`
                                : "For inquiries, contact the Municipal Agriculture Office (MAO)."}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Guidelines & Reminders */}
                    {detailsSchedule.farmer_notes ? (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                        <Info className="size-5 shrink-0 text-amber-700 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-xs sm:text-sm">Guidelines & Reminders</p>
                          <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-amber-900 font-medium">
                            {detailsSchedule.farmer_notes}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Slot Reservation Options (for programs with limited capacity) */}
                    {!isUnlimited ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800">
                            Choose Preferred Arrival Time:
                          </label>
                          <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-900 font-bold text-xs">
                            {isFull ? "0 slots left" : `${detailsSchedule.remaining_slots} slots available`}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {programTimes.map((slot) => {
                            const isSlotActive = time === slot && scheduleId === String(detailsSchedule.id);
                            return (
                              <Button
                                key={slot}
                                type="button"
                                variant={isSlotActive ? "default" : "outline"}
                                disabled={busy || isFull || isAlreadyBooked}
                                onClick={() => {
                                  setScheduleId(String(detailsSchedule.id));
                                  setTime(slot);
                                }}
                                className={`h-10 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                  isSlotActive
                                    ? "bg-emerald-800 text-white shadow-xs"
                                    : "border-slate-200 bg-white text-slate-800 hover:bg-emerald-50"
                                }`}
                              >
                                <Clock className="mr-1.5 size-3.5" />
                                <span>{formatTime(slot)}</span>
                              </Button>
                            );
                          })}
                        </div>

                        {isAlreadyBooked ? (
                          <p className="text-xs font-semibold text-amber-800">
                            You already have an active reservation for this program.
                          </p>
                        ) : (
                          <Button
                            type="button"
                            disabled={busy || !time || scheduleId !== String(detailsSchedule.id)}
                            onClick={book}
                            className="w-full h-11 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                          >
                            {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
                            <span>Confirm Slot Reservation</span>
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {/* Bottom Close Button */}
                    <Button
                      type="button"
                      onClick={() => setDetailsSchedule(null)}
                      className="w-full h-11 sm:h-12 rounded-xl bg-[#0F5A38] hover:bg-[#0c482d] text-white font-bold text-sm sm:text-base tracking-wide shadow-xs cursor-pointer"
                    >
                      Back to Schedule
                    </Button>
                  </>
                );
              })()}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={photoViewer !== null}
        onOpenChange={(open) => {
          if (!open) setPhotoViewer(null);
        }}
      >
        <DialogContent className="flex h-[min(85vh,900px)] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-3 overflow-hidden border-0 bg-slate-950 p-3 text-white sm:p-5 [&>button]:text-white [&>button]:hover:bg-white/10">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-base font-bold text-white">
              {photoViewer?.alt || "Program photos"}
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Click the arrows to browse the program photos.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black/40">
            {photoViewer ? (
              <ActivityPhotoCarousel
                key={`${photoViewer.alt}-${photoViewer.initialIndex}`}
                photos={photoViewer.photos}
                alt={photoViewer.alt}
                variant="dialog"
                initialIndex={photoViewer.initialIndex}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Only the time can change; the server checks ownership and available slots. */}
      <Dialog
        open={editingBooking !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditingBooking(null);
            setEditTime("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">Edit Appointment Time</DialogTitle>
            <DialogDescription>
              Choose an available time for {editingBooking?.program} on {editingBooking ? formatLongDate(editingBooking.date) : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(editingBooking?.available_times?.length ? editingBooking.available_times : PROGRAM_TIME_SLOTS).map((slot) => (
              <Button
                key={slot}
                type="button"
                variant={editTime === slot ? "default" : "outline"}
                disabled={busy}
                onClick={() => setEditTime(slot)}
                className={editTime === slot ? "min-h-11 bg-emerald-800 text-white hover:bg-emerald-900" : "min-h-11"}
              >
                <Clock className="mr-1.5 size-3.5" />
                {formatTime(slot)}
              </Button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setEditingBooking(null);
                setEditTime("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !editTime}
              onClick={() => void handleSaveBookingTime()}
              className="bg-emerald-800 text-white hover:bg-emerald-900"
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Cancellation */}
      <AlertDialog
        open={cancelingTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !busy) setCancelingTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Cancel Appointment Reservation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Are you sure you want to cancel your booking for{" "}
              <strong className="text-slate-900">{cancelingTarget?.program}</strong> on{" "}
              <strong className="text-slate-900">
                {cancelingTarget ? formatLongDate(cancelingTarget.date) : ""}
              </strong>
              ? This slot will immediately be made available for other farmers in Padre Garcia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-3">
            <AlertDialogCancel
              disabled={busy}
              className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold"
            >
              Keep My Booking
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
              className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold bg-rose-700 text-white hover:bg-rose-800"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Yes, Cancel Reservation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {bookingToast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-[var(--z-toast)] hidden w-[calc(100vw-2.5rem)] max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-xl transition-all duration-300 ease-in-out lg:flex ${
            bookingToastClosing || !bookingToastVisible
              ? "translate-x-[calc(100%+1.25rem)] opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Booking confirmed</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              {bookingToast}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss booking confirmation"
            onClick={() => setBookingToastClosing(true)}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function FarmerSchedulingPage() {
  return (
    <Suspense fallback={<CommunitySkeleton cards={4} />}>
      <FarmerSchedulingContent />
    </Suspense>
  );
}
