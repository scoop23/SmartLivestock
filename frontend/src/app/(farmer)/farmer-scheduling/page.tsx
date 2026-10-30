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
import { QrCodePass } from "@/components/qr-code-pass";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import api, { getActiveApiUrl } from "@/lib/axios";
import {
  ProgramBooking,
  ProgramSchedule,
  apiError,
  getBookings,
  getSchedules,
} from "@/lib/community-api";
import {
  Award,
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Clock3,
  CloudRain,
  Copy,
  Edit3,
  FileText,
  GraduationCap,
  HeartPulse,
  Home,
  Info,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  QrCode,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Syringe,
  Target,
  Users,
  User as UserIcon,
  X,
} from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

function parseBulletPoints(text: string | null | undefined, defaultItems: string[] = []): string[] {
  if (!text || !text.trim()) return defaultItems;
  const rawLines = text
    .split(/[\r\n]+|[•\u2022]|;/)
    .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
  if (rawLines.length > 0) return rawLines;
  return [text.trim()];
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "VACCINATION":
      return <Syringe className="size-6 text-emerald-700" />;
    case "ANIMAL_HEALTH":
      return <HeartPulse className="size-6 text-emerald-700" />;
    case "SEMINAR":
      return <GraduationCap className="size-6 text-emerald-700" />;
    case "CENSUS":
      return <ClipboardList className="size-6 text-emerald-700" />;
    default:
      return <Sparkles className="size-6 text-emerald-700" />;
  }
}

function FarmerSchedulingContent() {
  const searchParams = useSearchParams();
  const urlScheduleParam = searchParams.get("scheduleId") || searchParams.get("schedule");
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [activityDetailsSchedule, setActivityDetailsSchedule] = useState<ProgramSchedule | null>(null);
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

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"programs" | "bookings" | "guidelines">("programs");
  const [copiedId, setCopiedId] = useState(false);
  const [showIdPassModal, setShowIdPassModal] = useState(false);

  const userDisplayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username || "Mark Angelo Bathan";

  const userInitials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : "MB";

  const farmName = "Garcia Heritage Cattle & Swine Farm";
  const farmerBarangay = user?.barangay || "Poblacion";
  const farmerSitio = "Sitio Ilaya, Purok 3";
  const farmerPhone = user?.phoneNumber || "0917-555-8291";
  const farmerEmail = user?.email || "markangelo.bathan@smartlivestock.ph";
  const rsbsaId = "RSBSA-04-10-18-00921";

  const handleCopyRsbsa = () => {
    navigator.clipboard.writeText(rsbsaId);
    setCopiedId(true);
    toast.success("RSBSA ID copied to clipboard!");
    setTimeout(() => setCopiedId(false), 2000);
  };

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
      if (target.capacity === 0) {
        setActivityDetailsSchedule(target);
      } else {
        setScheduleId(String(target.id));
      }
      const frame = window.requestAnimationFrame(() => {
        const el = document.getElementById(`program-card-${target.id}`);
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Profile-Style Hero Header Banner (Matches Profile Design) */}
        <div className="relative rounded-3xl bg-gradient-to-r from-emerald-950 via-[#1B3E18] to-slate-900 border border-emerald-900/60 shadow-md overflow-hidden w-full text-white">
          {/* Subtle Organic Mesh Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.25),transparent_55%)] pointer-events-none" />
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Top Badges & Municipal Registry Ribbon */}
          <div className="px-5 sm:px-7 pt-5 pb-0 flex items-center justify-between gap-3 relative z-10 flex-wrap">
            <div className="text-emerald-200/80 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Padre Garcia Agricultural Management System (PGAMS) | Field Operations</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/15 backdrop-blur-md text-emerald-100 border border-white/20 shadow-sm">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Verified Agricultural Schedule
              </span>
            </div>
          </div>

          {/* Profile Card Main Row */}
          <div className="p-5 sm:p-7 md:p-8 pt-4 sm:pt-6 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
              {/* Avatar Pill with Camera Icon */}
              <div className="relative group shrink-0">
                <div className="size-24 sm:size-28 rounded-3xl bg-emerald-800/80 border-4 border-white/30 shadow-xl text-white font-black text-3xl sm:text-4xl flex items-center justify-center overflow-hidden relative">
                  {user?.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.profileImage}
                      alt={userDisplayName}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>

                <div
                  className="absolute -bottom-1 -right-1 size-7 rounded-full bg-emerald-500 text-white border-2 border-white flex items-center justify-center shadow-md z-15"
                  title="Account Verified"
                >
                  <Camera className="size-3.5 text-white" />
                </div>
              </div>

              {/* Profile Identity Details */}
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                    {userDisplayName}
                  </h1>
                  <Badge className="text-[10px] font-black uppercase px-2.5 py-0.5 border bg-emerald-500/30 text-emerald-100 border-emerald-400/40 backdrop-blur-xs">
                    LIVESTOCK RAISER
                  </Badge>
                </div>

                <p className="text-xs sm:text-sm font-bold text-emerald-100/90">
                  {farmName}
                </p>

                {/* Meta Quick Pills */}
                <div className="flex items-center gap-3 text-xs pt-1 flex-wrap">
                  <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 font-medium text-white shadow-2xs">
                    <MapPin className="size-3 text-emerald-300" />
                    <span>{farmerSitio}, Brgy. {farmerBarangay}, Padre Garcia, Batangas</span>
                  </span>

                  <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 font-medium text-white shadow-2xs">
                    <Phone className="size-3 text-emerald-300" />
                    <span>{farmerPhone}</span>
                  </span>

                  <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 font-medium text-white shadow-2xs">
                    <Mail className="size-3 text-emerald-300" />
                    <span>{farmerEmail}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button Strip & Verified Pills */}
            <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end gap-3 self-stretch md:self-center justify-end pt-3 md:pt-0 border-t md:border-t-0 border-white/15">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold text-emerald-100 bg-white/15 px-2.5 py-1 rounded-full border border-white/20 backdrop-blur-xs">
                  {rsbsaId}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white text-emerald-950 shadow-xs">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  Verified by MAO
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void refresh()}
                  disabled={isFetching}
                  className="bg-white hover:bg-emerald-50 text-[#1B3E18] font-black text-xs rounded-xl h-9 px-4 gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <RefreshCw className={`size-3.5 text-[#2D5A27] ${isFetching ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowIdPassModal(true)}
                  className="rounded-xl text-xs font-bold h-9 px-3.5 gap-1.5 bg-white/15 hover:bg-white/25 border-white/25 text-white backdrop-blur-md transition-all cursor-pointer"
                >
                  <QrCode className="size-3.5 text-emerald-300" />
                  <span>Pass QR</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Navigation Tabs Bar (Matches Profile Tabs Style) */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar w-full">
          <TabsList className="bg-slate-100/90 p-1.5 rounded-xl h-auto grid grid-cols-1 sm:grid-cols-3 gap-1.5 w-full">
            <TabsTrigger
              value="programs"
              onClick={() => setActiveTab("programs")}
              data-state={activeTab === "programs" ? "active" : "inactive"}
              className="px-4 py-2.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#2D5A27] data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center justify-center gap-2 text-slate-600 cursor-pointer transition-all"
            >
              <CalendarDays className="size-4" />
              <span>Program Schedule & Booking</span>
            </TabsTrigger>

            <TabsTrigger
              value="bookings"
              onClick={() => setActiveTab("bookings")}
              data-state={activeTab === "bookings" ? "active" : "inactive"}
              className="px-4 py-2.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#2D5A27] data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center justify-center gap-2 text-slate-600 cursor-pointer transition-all"
            >
              <CalendarCheck className="size-4" />
              <span>My Appointments ({upcoming.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="guidelines"
              onClick={() => setActiveTab("guidelines")}
              data-state={activeTab === "guidelines" ? "active" : "inactive"}
              className="px-4 py-2.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#2D5A27] data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center justify-center gap-2 text-slate-600 cursor-pointer transition-all"
            >
              <FileText className="size-4" />
              <span>Program Guidelines & Venues</span>
            </TabsTrigger>
          </TabsList>
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

        {/* 3. Two-Column Dashboard Layout (Matches Profile Grid: Left Info & Overview, Right Active Workspace) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
          {/* Left Column: Account Overview, Agricultural Credentials, Farm Information */}
          <div className="xl:col-span-5 space-y-6">
            {/* Card 1: Account Overview (Exact match to profile screenshot) */}
            <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700">
                    <Bell className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Account Overview</h3>
                    <p className="text-xs text-slate-500 font-medium">Summary of your profile and registration status.</p>
                  </div>
                </div>

                {/* 3 Metric Chips Row */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center gap-1">
                    <div className="size-8 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
                      <UserIcon className="size-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Profile Status</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="size-3 text-emerald-600" /> Complete
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center gap-1">
                    <div className="size-8 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
                      <FileText className="size-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RSBSA Registration</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="size-3 text-emerald-600" /> Verified by MAO
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center gap-1">
                    <div className="size-8 rounded-full bg-sky-100 text-sky-700 grid place-items-center">
                      <Shield className="size-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account Security</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800">
                      <CheckCircle2 className="size-3 text-sky-600" /> 2FA Active
                    </span>
                  </div>
                </div>

                {/* Telemetry Highlight: Next Farm Visit / Active Program */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 flex items-start gap-2.5">
                  <Clock3 className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      {nextVisit ? `Next Field Visit: ${nextVisit.program}` : "Next Field Visit: No pending appointments"}
                    </p>
                    <p className="text-emerald-900 text-[11px]">
                      {nextVisit
                        ? `${formatLongDate(nextVisit.date)} at ${formatTime(nextVisit.time)} · ${
                            schedules.find((s) => s.id === nextVisit.schedule)?.location || "Padre Garcia"
                          }`
                        : "Browse highlighted program dates on the schedule calendar to reserve a slot."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Agricultural Credentials (Exact match to profile screenshot) */}
            <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Award className="size-4 text-[#2D5A27]" />
                    <span>Agricultural Credentials</span>
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-black uppercase">
                    OFFICIAL
                  </Badge>
                </div>

                {/* RSBSA Code Callout */}
                <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      RSBSA Identification No.
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRsbsa}
                      className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                      <span>{copiedId ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="text-sm font-mono font-black text-slate-900 tracking-tight">
                    {rsbsaId}
                  </div>
                </div>

                {/* Directory */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Assigned Office</span>
                    <span className="font-bold text-slate-800 text-right">Municipal Agriculture Office (MAO)</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Cooperative / Association</span>
                    <span className="font-bold text-slate-800 text-right">Padre Garcia Cattle Raisers Association (PGCRA)</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-1">
                    <span className="text-slate-500 font-medium">Open Programs</span>
                    <span className="font-bold text-emerald-800 text-right">{schedules.length} Active in Municipality</span>
                  </div>
                </div>

                {/* Green Notice Box */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Your account is linked to the official municipal registry.</strong> Your information and livestock records are protected under the Padre Garcia agricultural data governance policy.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Farm Information (Exact match to profile screenshot) */}
            <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Home className="size-4 text-[#2D5A27]" />
                    <span>Farm Information</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                    <Edit3 className="size-3" /> Edit
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Farm / Holding Facility Name</span>
                    <span className="font-bold text-slate-800 text-right">{farmName}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Operation Type</span>
                    <span className="font-bold text-slate-800 text-right">Semi-Commercial Cattle & Dairy</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Sitio / Street / Zone</span>
                    <span className="font-bold text-slate-800 text-right">{farmerSitio}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Barangay</span>
                    <span className="font-bold text-slate-800 text-right">{farmerBarangay}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 py-1">
                    <span className="text-slate-500 font-medium">Municipality & ZIP</span>
                    <span className="font-bold text-slate-800 text-right">Padre Garcia, Batangas (4224)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Interactive Scheduling Suite & Bookings */}
          <div className="xl:col-span-7 space-y-6">
            {/* Guidelines Card (Shown when guidelines tab is selected) */}
            {activeTab === "guidelines" ? (
              <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden animate-in fade-in duration-300">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <h3 className="flex items-center gap-2.5 text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    <FileText className="size-5 text-emerald-700" />
                    <span>Official Program Guidelines & Venue Reminders</span>
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Standard operating protocols established by the Municipal Agriculture Office (MAO) of Padre Garcia.
                  </p>
                </div>
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="size-3.5 text-emerald-700" /> Arrival Window
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        Please arrive within 15 minutes of your reserved time slot to ensure proper queueing and veterinary triage.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Award className="size-3.5 text-emerald-700" /> Identification Required
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        Bring your RSBSA stub or present your Digital Municipal ID Pass QR code on-site for immediate attendee check-in.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-emerald-700" /> Animal Biosecurity
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        Livestock showing acute respiratory symptoms, vesicular lesions, or high fever must be reported immediately prior to transport.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Phone className="size-3.5 text-emerald-700" /> MAO Hotline
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        For rescheduling, venue changes, or weather emergencies, contact the Municipal Agriculture Office at (043) 555-8291.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

        {/* 2. Interactive Booking Suite */}
        <section aria-label="Book a program appointment" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
          <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
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
                        2. Choose Field Program
                      </h3>
                      {calendarDate ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-600">
                          {formatLongDate(isoFromLocalDate(calendarDate))}
                        </span>
                      ) : null}
                    </div>

                    {!calendarDate ? (
                      <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-8 text-center">
                        <CalendarDays className="mx-auto size-8 text-emerald-600" />
                        <h4 className="mt-2 text-sm sm:text-base font-bold text-slate-800">Choose a date first</h4>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600">
                          Select a highlighted date on the calendar to see programs available for booking.
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
                        const isSelected = selected?.id === schedule.id;
                        const programPhotos = [
                          ...(schedule.cover_image ? [programImageUrl(schedule.cover_image)] : []),
                          ...(schedule.photos ?? []).map((photo) => programImageUrl(photo.image)),
                        ];

                        const bookedPercent = schedule.capacity
                          ? Math.min(100, Math.round((schedule.booking_count / schedule.capacity) * 100))
                          : 0;

                        return (
                          <div
                            key={schedule.id}
                            id={`program-card-${schedule.id}`}
                            onClick={() => {
                              if (isClosed) return;
                              if (isUnlimited) {
                                setActivityDetailsSchedule(schedule);
                                return;
                              }
                              if (isFull || alreadyBooked) return;
                              setScheduleId(String(schedule.id));
                              setTime("");
                            }}
                            className={`group relative flex flex-col justify-between rounded-2xl border p-4.5 transition-all duration-200 ${
                              isClosed || (!isUnlimited && (isFull || alreadyBooked))
                                ? "cursor-not-allowed border-slate-200 bg-slate-50/60 opacity-80"
                                : isSelected
                                  ? "cursor-pointer border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-600 shadow-sm"
                                  : isUnlimited
                                    ? "cursor-pointer border-emerald-200/90 bg-gradient-to-b from-emerald-50/20 to-white hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-xs"
                                    : "cursor-pointer border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-xs"
                            }`}
                          >
                            <div className="-mx-4.5 -mt-4.5 mb-3 overflow-hidden rounded-t-2xl bg-gradient-to-br from-emerald-50 to-slate-100">
                              <div className="h-40 w-full sm:h-48">
                                <ActivityPhotoCarousel
                                  photos={programPhotos}
                                  alt={`${schedule.program} activity`}
                                  onImageClick={(initialIndex) =>
                                    setPhotoViewer({
                                      photos: programPhotos,
                                      alt: `${schedule.program} activity`,
                                      initialIndex,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0"><h4 className="line-clamp-2 text-base font-black text-slate-900 tracking-tight transition-colors group-hover:text-emerald-800">{schedule.program}</h4><Badge variant="outline" className="mt-1 text-[10px]">{schedule.category.replaceAll("_", " ")}</Badge></div>
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-xs font-bold uppercase tracking-wider ${
                                    isClosed
                                      ? "border-slate-200 bg-slate-100 text-slate-600"
                                      : isUnlimited
                                        ? "border-emerald-300 bg-emerald-100 text-emerald-950 font-black shadow-2xs"
                                        : isFull
                                          ? "border-amber-200 bg-amber-50 text-amber-900"
                                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  }`}
                                >
                                  {isClosed
                                    ? (schedule.registration_status === "NOT_OPEN" ? "OPENS SOON" : "CLOSED")
                                    : isUnlimited
                                      ? "OPEN ADMISSION · WALK-IN"
                                      : alreadyBooked
                                        ? "BOOKED"
                                        : isFull
                                          ? "FULL"
                                          : "OPEN FOR REGISTRATION"}
                                </Badge>
                              </div>

                              {/* Details: Venue & Time Window */}
                              <div className="space-y-1.5 text-xs sm:text-sm text-slate-600 font-medium">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="size-3.5 shrink-0 text-emerald-700" />
                                  <span className="font-semibold text-slate-800">{formatLongDate(schedule.date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock3 className="size-3.5 shrink-0 text-slate-400" />
                                  <span>
                                    {formatTime(selectedAvailableTimes[0])} –{" "}
                                    {formatTime(selectedAvailableTimes[selectedAvailableTimes.length - 1])}
                                  </span>
                                </div>
                                {schedule.location ? (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="size-3.5 shrink-0 text-rose-500" />
                                    <span className="truncate">{schedule.location}</span>
                                  </div>
                                ) : null}
                                {schedule.barangay_name ? <div className="text-xs font-semibold text-slate-500">For {schedule.barangay_name} farmers</div> : <div className="text-xs font-semibold text-slate-500">Municipality-wide program</div>}
                                {schedule.registration_deadline ? <div className="text-xs font-semibold text-amber-800">Register by {formatLongDate(schedule.registration_deadline)}</div> : null}
                                {schedule.registration_opens && schedule.registration_status === "NOT_OPEN" ? <div className="text-xs font-semibold text-sky-800">Registration opens {formatLongDate(schedule.registration_opens)}</div> : null}
                                {schedule.description ? <p className="line-clamp-3 leading-relaxed text-slate-700">{schedule.description}</p> : null}
                                {schedule.objectives ? <p className="line-clamp-2 text-xs text-slate-600"><strong>Objectives:</strong> {schedule.objectives}</p> : null}
                                {schedule.eligibility ? <p className="line-clamp-2 text-xs text-slate-600"><strong>Who can join:</strong> {schedule.eligibility}</p> : null}
                                {schedule.contact_information ? <p className="text-xs text-slate-600"><strong>Contact:</strong> {schedule.contact_information}</p> : null}
                                {schedule.farmer_notes ? (
                                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
                                    <Info className="mt-0.5 size-4 shrink-0 text-amber-700" />
                                    <div><p className="font-bold">Reminder</p><p className="mt-0.5 whitespace-pre-wrap font-normal">{schedule.farmer_notes}</p></div>
                                  </div>
                                ) : null}
                              </div>

                              {/* Capacity Bar */}
                              {isUnlimited ? (
                                <div className="flex items-center gap-2 rounded-xl bg-emerald-50/90 border border-emerald-200 p-2.5 text-xs text-emerald-950 font-medium">
                                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                                  <span><strong>No slot limit:</strong> Open walk-in attendance. No reservation needed.</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                                  <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="font-medium text-slate-700">
                                      Capacity: <strong className="font-bold text-slate-900">{schedule.booking_count}</strong>/{schedule.capacity}
                                    </span>
                                    <span className="font-bold text-emerald-800">
                                      {isFull ? (
                                        <span className="text-amber-800">0 left</span>
                                      ) : (
                                        `${schedule.remaining_slots} left`
                                      )}
                                    </span>
                                  </div>
                                  {schedule.capacity > 0 ? (
                                    <Progress
                                      value={bookedPercent}
                                      className="h-1.5 rounded-full bg-slate-200 [&>div]:bg-emerald-600"
                                    />
                                  ) : null}
                                </div>
                              )}
                            </div>

                            {/* Select / Active Button State */}
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isClosed || (!isUnlimited && (isFull || alreadyBooked))}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isUnlimited) {
                                    setActivityDetailsSchedule(schedule);
                                    return;
                                  }
                                  setScheduleId(String(schedule.id));
                                  setTime("");
                                }}
                                className={`w-full h-9 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                  isSelected
                                    ? "bg-emerald-800 text-white shadow-xs"
                                    : isUnlimited
                                      ? "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                                      : alreadyBooked
                                        ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {isClosed ? (
                                  <span>{schedule.registration_status === "NOT_OPEN" ? "Opens soon" : "Registration closed"}</span>
                                ) : isUnlimited ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Sparkles className="size-3.5 text-emerald-700" /> View Details (Walk-in)
                                  </span>
                                ) : alreadyBooked ? (
                                  <span>Already booked</span>
                                ) : isFull ? (
                                  <span>Fully booked</span>
                                ) : isSelected ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Check className="size-4" /> Selected
                                  </span>
                                ) : (
                                  <span>Select this program</span>
                                )}
                              </Button>
                              {!isUnlimited ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivityDetailsSchedule(schedule);
                                  }}
                                  className="mt-2 text-center w-full text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
                                >
                                  View Activity Details
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Step 3: Time Slot Selection & Confirmation Drawer OR Open Walk-in Activity Details */}
                    {selected ? (
                      selected.capacity === 0 ? (
                        <div
                          id="program-details-section"
                          className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center flex flex-col items-center justify-center gap-3 animate-in fade-in-50 duration-200 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-900">
                            <Sparkles className="size-4 text-emerald-700" />
                            <span>Open Municipal Program</span>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-emerald-950 max-w-lg">
                            <strong>{selected.program}</strong> is open for walk-in attendance on {formatLongDate(selected.date)}. No slot booking or advance reservation is required.
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <Button
                              type="button"
                              onClick={() => setActivityDetailsSchedule(selected)}
                              className="h-10 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs cursor-pointer px-4"
                            >
                              <Sparkles className="size-3.5 mr-1.5 text-emerald-300" /> View Activity Details
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setScheduleId("");
                                setTime("");
                              }}
                              className="h-10 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer px-4"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-6 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-50/40 to-white p-4 sm:p-6 shadow-xs space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-200/60 pb-3.5">
                            <div className="flex items-start gap-3">
                              {selected.cover_image ? (
                                <div className="size-14 sm:size-16 rounded-xl overflow-hidden border border-emerald-200/80 shrink-0 relative shadow-2xs bg-slate-100">
                                  <Image
                                    src={programImageUrl(selected.cover_image)}
                                    alt={selected.program}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                  />
                                </div>
                              ) : null}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-emerald-800 px-2.5 py-0.5 text-xs font-black text-white">
                                    Step 3
                                  </span>
                                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    Pick Arrival Time Slot
                                  </h3>
                                </div>
                                <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">
                                  Reserving for <strong className="text-slate-900">{selected.program}</strong> on{" "}
                                  <strong className="text-slate-900">{formatLongDate(selected.date)}</strong>
                                  {selected.location ? ` at ${selected.location}` : ""}.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setActivityDetailsSchedule(selected)}
                                className="h-8 rounded-xl border-emerald-300 bg-white text-xs font-bold text-emerald-900 hover:bg-emerald-50 cursor-pointer"
                              >
                                <Sparkles className="size-3.5 mr-1 text-emerald-700" /> Details
                              </Button>
                              <Badge
                                variant="outline"
                                className="border-emerald-300 bg-white text-emerald-900 font-bold text-xs sm:text-sm px-3 py-1"
                              >
                                {`${selected.remaining_slots} slots available`}
                              </Badge>
                            </div>
                          </div>

                          {/* Slot Buttons */}
                          <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 block">
                              Choose Your Preferred Arrival Time:
                            </label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {availableTimes.map((slot) => {
                                const isSlotActive = time === slot;
                                return (
                                  <Button
                                    key={slot}
                                    type="button"
                                    variant={isSlotActive ? "default" : "outline"}
                                    disabled={busy || (selected.capacity > 0 && selected.remaining_slots === 0) || confirmedScheduleIds.has(selected.id)}
                                    onClick={() => setTime(slot)}
                                    className={`h-11 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                      isSlotActive
                                        ? "bg-emerald-800 text-white hover:bg-emerald-900 shadow-sm ring-2 ring-emerald-800/30"
                                        : "border-slate-200 bg-white text-slate-800 hover:bg-emerald-50 hover:border-emerald-300"
                                    }`}
                                  >
                                    <Clock className="mr-1.5 size-3.5" />
                                    <span>{formatTime(slot)}</span>
                                  </Button>
                                );
                              })}
                            </div>
                          </div>

                          {confirmedScheduleIds.has(selected.id) ? (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm font-semibold text-amber-900">
                              You already have an active booking for this program. To modify your time, cancel your existing reservation below first.
                            </p>
                          ) : null}

                          {/* Bottom Confirmation Bar */}
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-emerald-200/60 pt-4">
                            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600">
                              <Info className="size-4 shrink-0 text-emerald-700" />
                              <span>Official municipal service. Free of charge for registered farmers.</span>
                            </div>

                            <Button
                              type="button"
                              disabled={
                                busy ||
                                !time ||
                                availableTimes.length === 0 ||
                                confirmedScheduleIds.has(selected.id)
                              }
                              onClick={book}
                              className="h-11 gap-2 rounded-xl bg-emerald-800 px-6 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-900 active:scale-95 transition-all cursor-pointer"
                            >
                              {busy ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <CalendarCheck className="size-4" />
                              )}
                              <span>Confirm Reservation</span>
                            </Button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                        <p className="text-xs sm:text-sm font-medium text-slate-500">
                          Click on any program card above to open its full activity details or available appointment time slots.
                        </p>
                      </div>
                    )}
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
      </div>

      {/* Digital Municipal ID Pass Modal (Matches Profile Pass QR) */}
      <Dialog open={showIdPassModal} onOpenChange={setShowIdPassModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl p-6 rounded-3xl bg-white border-0 shadow-2xl max-h-[94vh] overflow-y-auto">
          <DialogHeader className="space-y-1 text-center">
            <DialogTitle className="text-xl font-black text-slate-900">
              Farmer profile identification
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Field personnel and MAO inspectors can scan this profile QR to verify your registered farmer status and attendance.
            </DialogDescription>
          </DialogHeader>

          {user?.farmerId ? (
            <QrCodePass
              code={`SL-FARMER:${user.farmerId}`}
              qrPayload={`SL-FARMER:${user.farmerId}`}
              title="Farmer account QR"
              subtitle="Show this QR to field inspectors to look up your registered programs and livestock."
              ownerName={userDisplayName}
              status="ACCOUNT ID"
              compact
            />
          ) : (
            <QrCodePass
              code="SL-FARMER:041018"
              qrPayload="SL-FARMER:041018-00921"
              title="Farmer account QR"
              subtitle="Show this QR to field inspectors to look up your registered programs and livestock."
              ownerName={userDisplayName}
              status="ACCOUNT ID"
              compact
            />
          )}

          <Button
            type="button"
            onClick={() => setShowIdPassModal(false)}
            className="w-full bg-[#2D5A27] hover:bg-[#234620] text-white font-bold text-xs rounded-xl h-9.5 cursor-pointer mt-2"
          >
            Close Pass
          </Button>
        </DialogContent>
      </Dialog>

      {/* Activity Details Popup Modal (Matches user specifications from field programs) */}
      <Dialog
        open={activityDetailsSchedule !== null}
        onOpenChange={(open) => {
          if (!open) setActivityDetailsSchedule(null);
        }}
      >
        <DialogContent className="w-full max-w-lg sm:max-w-xl md:max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-3xl border-slate-200 shadow-2xl bg-white block space-y-4">
          {activityDetailsSchedule ? (
            <div className="space-y-4 text-left">
              <DialogHeader className="sr-only">
                <DialogTitle>{activityDetailsSchedule.program}</DialogTitle>
                <DialogDescription>
                  Full program schedule and venue details for {activityDetailsSchedule.program}
                </DialogDescription>
              </DialogHeader>

              {/* Top Navigation / Back link */}
              <div>
                <button
                  type="button"
                  onClick={() => setActivityDetailsSchedule(null)}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer group -ml-1 py-1 px-1.5 rounded-lg hover:bg-slate-100"
                >
                  <ChevronLeft className="size-4 text-slate-600 group-hover:text-emerald-800 transition-transform group-hover:-translate-x-0.5" />
                  <span>Back to Field Program Schedule</span>
                </button>
              </div>

              {/* Image Banner at Top (Where arrow points) */}
              <div className="relative w-full h-48 sm:h-56 md:h-64 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-xs shrink-0">
                <Image
                  src={
                    activityDetailsSchedule.cover_image
                      ? programImageUrl(activityDetailsSchedule.cover_image)
                      : activityDetailsSchedule.photos?.[0]?.image
                        ? programImageUrl(activityDetailsSchedule.photos[0].image)
                        : "/images/species-cattle.jpg"
                  }
                  alt={activityDetailsSchedule.program}
                  fill
                  unoptimized
                  className="object-cover"
                  priority
                />
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#14532d] text-white shadow-2xs">
                  {activityDetailsSchedule.barangay_name
                    ? `Barangay ${activityDetailsSchedule.barangay_name} Program`
                    : "Open Municipal Program"}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 bg-slate-100 text-slate-700">
                  {activityDetailsSchedule.capacity === 0 ? "No Registration Needed" : "Registration Required"}
                </span>
              </div>

              {/* Category Icon + Program Title + Subtitle */}
              <div className="flex items-start gap-3.5 pt-1">
                <div className="size-11 sm:size-12 rounded-2xl bg-emerald-100/90 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/70 shadow-2xs">
                  {getCategoryIcon(activityDetailsSchedule.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                    {activityDetailsSchedule.program}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">
                    Activity scheduled on{" "}
                    <strong className="text-slate-900">{formatLongDate(activityDetailsSchedule.date)}</strong>
                    {activityDetailsSchedule.location ? (
                      <>
                        {" "}at <strong className="text-slate-900">{activityDetailsSchedule.location}</strong>
                      </>
                    ) : null}
                    .
                  </p>
                </div>
              </div>

              {/* Highlight Callout Box */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 sm:p-4 flex items-start gap-3 shadow-2xs">
                <div className="size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    {activityDetailsSchedule.capacity === 0
                      ? "Open Walk-in for All Eligible Farmers"
                      : "Appointment Registration for All Eligible Farmers"}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {activityDetailsSchedule.capacity === 0
                      ? "You can attend directly at the venue during operating hours. No booking or reservation needed."
                      : "Select your preferred arrival time window from the schedule page to confirm your slot."}
                  </p>
                </div>
              </div>

              {/* Structured Activity Information List */}
              <div className="space-y-4 pt-1 divide-y divide-slate-100 [&>*:not(:first-child)]:pt-4">
                {/* Date & Time */}
                <div className="flex items-start gap-3.5">
                  <div className="size-9 sm:size-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 shadow-2xs">
                    <CalendarDays className="size-5" />
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <h5 className="text-sm font-bold text-slate-900">Date & Time</h5>
                    <p className="text-xs sm:text-sm font-medium text-slate-700">
                      {formatLongDate(activityDetailsSchedule.date)}
                    </p>
                    <p className="text-xs sm:text-sm font-medium text-slate-500">
                      {activityDetailsSchedule.available_times?.length
                        ? `${formatTime(activityDetailsSchedule.available_times[0])} – ${formatTime(
                            activityDetailsSchedule.available_times[
                              activityDetailsSchedule.available_times.length - 1
                            ],
                          )}`
                        : "8:00 AM – 1:30 PM"}
                    </p>
                  </div>
                </div>

                {/* Venue / Location */}
                <div className="flex items-start gap-3.5">
                  <div className="size-9 sm:size-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600 shadow-2xs">
                    <MapPin className="size-5" />
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <h5 className="text-sm font-bold text-slate-900">Venue / Location</h5>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 break-words">
                      {activityDetailsSchedule.location || "Banaba Covered Court"}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {activityDetailsSchedule.barangay_name
                        ? `Designated for farmers of Barangay ${activityDetailsSchedule.barangay_name}`
                        : "Open municipality-wide across all barangays of Padre Garcia"}
                    </p>
                  </div>
                </div>

                {/* Program Description */}
                {activityDetailsSchedule.description ? (
                  <div className="flex items-start gap-3.5">
                    <div className="size-9 sm:size-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 shadow-2xs">
                      <FileText className="size-5" />
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <h5 className="text-sm font-bold text-slate-900">Program Description</h5>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-wrap">
                        {activityDetailsSchedule.description}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Objectives & Services Provided */}
                <div className="flex items-start gap-3.5">
                  <div className="size-9 sm:size-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 text-teal-700 shadow-2xs">
                    <Target className="size-5" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="text-sm font-bold text-slate-900">Objectives & Services Provided</h5>
                    <ul className="space-y-1 text-xs sm:text-sm text-slate-600">
                      {parseBulletPoints(activityDetailsSchedule.objectives, [
                        "Prevent common cattle diseases",
                        "Promote healthier and more productive livestock",
                        "Free cattle vaccination",
                      ]).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-slate-400 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Eligibility & Inquiries */}
                <div className="flex items-start gap-3.5">
                  <div className="size-9 sm:size-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 shadow-2xs">
                    <Users className="size-5" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h5 className="text-sm font-bold text-slate-900">Eligibility & Inquiries</h5>
                    <ul className="space-y-1 text-xs sm:text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <span className="text-slate-400 font-bold">•</span>
                        <span>
                          {activityDetailsSchedule.eligibility?.trim() ||
                            (activityDetailsSchedule.barangay_name
                              ? `Open to all registered livestock farmers in Barangay ${activityDetailsSchedule.barangay_name}.`
                              : "Open to all registered livestock farmers in Barangay Manggas.")}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-slate-400 font-bold">•</span>
                        <span>
                          {activityDetailsSchedule.contact_information?.trim()
                            ? `For inquiries, contact: ${activityDetailsSchedule.contact_information}`
                            : "For inquiries, contact the Municipal Agriculture Office (MAO)."}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Guidelines & Reminders (if notes present) */}
                {activityDetailsSchedule.farmer_notes ? (
                  <div className="flex items-start gap-3.5">
                    <div className="size-9 sm:size-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-amber-700 shadow-2xs">
                      <Info className="size-5" />
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <h5 className="text-sm font-bold text-amber-950">Guidelines & Reminders</h5>
                      <p className="text-xs sm:text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                        {activityDetailsSchedule.farmer_notes}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Bottom Go Back Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => setActivityDetailsSchedule(null)}
                  className="w-full h-11 sm:h-12 rounded-2xl bg-[#0F5A38] hover:bg-[#0c462c] text-white font-bold text-sm sm:text-base shadow-sm transition-all cursor-pointer"
                >
                  Go Back to Schedule
                </Button>
              </div>
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
