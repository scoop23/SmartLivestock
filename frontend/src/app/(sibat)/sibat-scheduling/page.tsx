"use client";

import { useState, useEffect, useMemo, useCallback, FormEvent, Suspense, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  Megaphone,
  Check,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Calendar as CalendarIcon,
  HelpCircle,
  ExternalLink,
  Upload,
  Camera,
  ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import api, { getActiveApiUrl } from "@/lib/axios";
import {
  getSchedules,
  getBookings,
  getActivities,
  type ProgramSchedule,
  type ProgramBooking,
  type Activity,
  apiError,
} from "@/lib/community-api";
import { formatTime, todayIso } from "@/app/components/community/community-ui";
import { useAuth } from "@/contexts/auth-context";

// ── Types & Helpers ────────────────────────────────────────────────────────

function programImageUrl(path: string): string {
  if (path.startsWith("blob:")) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${getActiveApiUrl().replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface ScheduleItem {
  id: string | number;
  name: string;
  type: string;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  notes: string;
  status: "Upcoming" | "Past" | "Cancelled" | "Closed" | "Completed";
  participants: number;
  cover_image?: string | null;
  raw?: ProgramSchedule;
}

const ACTIVITY_TYPES = [
  "Vaccination",
  "Deworming",
  "Vitamin Supplementation",
  "Other Animal Health Activity",
] as const;

function mapCategoryToType(category: string, objectives?: string): string {
  if (objectives && ACTIVITY_TYPES.some((t) => t.toLowerCase() === objectives.toLowerCase())) {
    return objectives;
  }
  switch (category) {
    case "VACCINATION":
      return "Vaccination";
    case "ANIMAL_HEALTH":
      return "Deworming";
    default:
      return "Other Animal Health Activity";
  }
}

function mapScheduleStatus(s: ProgramSchedule): ScheduleItem["status"] {
  if (s.publication_status === "CANCELLED") return "Cancelled";
  if (s.publication_status === "COMPLETED") return "Completed";
  if (s.date < todayIso()) return "Past";
  if (!s.is_open || s.registration_status === "CLOSED") return "Closed";
  return "Upcoming";
}

function formatScheduleItem(raw: ProgramSchedule, bookings: ProgramBooking[]): ScheduleItem {
  const scheduleBookings = bookings.filter(
    (b) => b.schedule === raw.id && b.status === "CONFIRMED"
  );
  const times = raw.available_times || [];
  const start = times[0] || "08:00";
  const end = times[times.length - 1] || "12:00";

  return {
    id: raw.id,
    name: raw.program,
    type: mapCategoryToType(raw.category, raw.objectives),
    date: raw.date,
    start,
    end,
    location: raw.location,
    description: raw.description || "",
    notes: raw.farmer_notes || "",
    status: mapScheduleStatus(raw),
    participants: scheduleBookings.length || raw.booking_count || 0,
    cover_image: raw.cover_image || null,
    raw,
  };
}

// ── Main Page Component ───────────────────────────────────────────────────

export default function SibatSchedulingPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"schedules" | "schedule-form">("schedules");
  const [tab, setTab] = useState<"Upcoming" | "Past">("Upcoming");
  const [rawSchedules, setRawSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [announcements, setAnnouncements] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [editTarget, setEditTarget] = useState<ScheduleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Month navigation for the interactive calendar
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  // Online status
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch live schedules and bookings
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [schedulesRes, bookingsRes, announcementsRes] = await Promise.allSettled([
        getSchedules(),
        getBookings(),
        getActivities(),
      ]);

      if (schedulesRes.status === "fulfilled") setRawSchedules(schedulesRes.value);
      if (bookingsRes.status === "fulfilled") setBookings(bookingsRes.value);
      if (announcementsRes.status === "fulfilled") setAnnouncements(announcementsRes.value);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Formatted schedule items
  const schedules: ScheduleItem[] = useMemo(() => {
    return rawSchedules.map((raw) => formatScheduleItem(raw, bookings));
  }, [rawSchedules, bookings]);

  // Filter schedules based on active tab and optional selected calendar date
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const matchesTab =
        tab === "Upcoming"
          ? s.status === "Upcoming" || s.status === "Closed"
          : s.status === "Past" || s.status === "Cancelled" || s.status === "Completed";

      if (!matchesTab) return false;
      if (selectedDateFilter && s.date !== selectedDateFilter) return false;

      return true;
    });
  }, [schedules, tab, selectedDateFilter]);

  // Upcoming vs Past counts
  const upcomingCount = useMemo(
    () => schedules.filter((s) => s.status === "Upcoming" || s.status === "Closed").length,
    [schedules]
  );
  const pastCount = useMemo(
    () =>
      schedules.filter(
        (s) => s.status === "Past" || s.status === "Cancelled" || s.status === "Completed"
      ).length,
    [schedules]
  );

  // Calendar calculations
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Find days in current calendar month that have schedules
  const daysWithEvents = useMemo(() => {
    const set = new Set<number>();
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const yearStr = String(currentYear);

    schedules.forEach((s) => {
      const [y, m, d] = s.date.split("-");
      if (y === yearStr && m === monthStr) {
        set.add(parseInt(d, 10));
      }
    });
    return set;
  }, [schedules, currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleCalendarDayClick = (dayNumber: number) => {
    const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(
      dayNumber
    ).padStart(2, "0")}`;

    if (selectedDateFilter === formattedDate) {
      setSelectedDateFilter(null);
    } else {
      setSelectedDateFilter(formattedDate);
    }
  };

  // Check if an editing schedule has a published announcement
  const hasPublishedAnnouncement = useMemo(() => {
    if (!editTarget || !editTarget.raw) return false;
    return announcements.some(
      (a) =>
        a.is_published &&
        (a.schedule?.id === editTarget.raw?.id ||
          a.title.toLowerCase().includes(editTarget.name.toLowerCase()))
    );
  }, [editTarget, announcements]);

  // Delete handler
  const handleDeleteSchedule = async () => {
    if (!deleteTarget || !deleteTarget.raw) return;
    try {
      await api.delete(`/community/schedules/${deleteTarget.raw.id}/`);
      toast.success("Schedule removed.");
      setDeleteTarget(null);
      setSelectedSchedule(null);
      await loadData();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  // Toggle close / reopen
  const handleToggleStatus = async (item: ScheduleItem) => {
    if (!item.raw) return;
    const isCurrentlyOpen = item.raw.is_open;
    try {
      await api.patch(`/community/schedules/${item.raw.id}/`, {
        is_open: !isCurrentlyOpen,
      });
      toast.success(isCurrentlyOpen ? "Schedule registration closed." : "Registration reopened.");
      await loadData();
      if (selectedSchedule?.id === item.id) {
        setSelectedSchedule((prev) =>
          prev
            ? {
                ...prev,
                status: isCurrentlyOpen ? "Closed" : "Upcoming",
                raw: { ...prev.raw!, is_open: !isCurrentlyOpen },
              }
            : null
        );
      }
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  // ── Render Form View ──
  if (view === "schedule-form") {
    return (
      <ScheduleForm
        current={editTarget || undefined}
        onCancel={() => {
          setEditTarget(null);
          setView("schedules");
        }}
        onSaved={async () => {
          setEditTarget(null);
          setView("schedules");
          await loadData();
        }}
        isOnline={isOnline}
        hasPublishedAnnouncement={hasPublishedAnnouncement}
        assignedBarangayId={user?.assignedBarangayId}
      />
    );
  }

  // ── Render Schedules Page View ──
  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Schedules & Activities"
        subtitle="Manage vaccination, deworming, and other animal health activities."
        icon={<CalendarDays className="size-5 text-white" />}
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <Button
            onClick={() => {
              setEditTarget(null);
              setView("schedule-form");
            }}
            className="rounded-xl sm:rounded-2xl bg-white text-emerald-950 hover:bg-emerald-50 font-bold text-xs sm:text-sm px-4 py-2 shrink-0 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="size-4 text-emerald-700" />
            Create Schedule
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-[1500px] min-w-0 space-y-5 px-3.5 py-4 sm:p-6 lg:px-8">

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => {
            setTab("Upcoming");
            setSelectedDateFilter(null);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            tab === "Upcoming"
              ? "bg-[#1E3A2F] text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <span>Upcoming Activities</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              tab === "Upcoming" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {upcomingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab("Past");
            setSelectedDateFilter(null);
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            tab === "Past"
              ? "bg-[#1E3A2F] text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <span>Past & Cancelled</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              tab === "Past" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {pastCount}
          </span>
        </button>

        {selectedDateFilter && (
          <div className="ml-auto flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-xl shrink-0">
            <span>Filtered on: <b>{selectedDateFilter}</b></span>
            <button
              type="button"
              onClick={() => setSelectedDateFilter(null)}
              className="text-emerald-700 hover:text-emerald-950 p-0.5"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Schedule Layout: Calendar Card on Left, Activities List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
        {/* LEFT COLUMN: Interactive Calendar Card */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">{monthName}</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                className="size-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:text-slate-900"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                className="size-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:text-slate-900"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            {/* Days of week */}
            <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-black uppercase text-slate-400 tracking-wider">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Days cells */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {/* Padding empty slots */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-8 sm:h-9" />
              ))}

              {/* Day numbers */}
              {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const hasEvent = daysWithEvents.has(day);
                const dayIso = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(
                  day
                ).padStart(2, "0")}`;
                const isSelected = selectedDateFilter === dayIso;
                const isToday =
                  today.getDate() === day &&
                  today.getMonth() === currentMonth &&
                  today.getFullYear() === currentYear;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleCalendarDayClick(day)}
                    className={`relative h-8 sm:h-9 rounded-xl flex flex-col items-center justify-center font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1E3A2F] text-white shadow-xs"
                        : hasEvent
                          ? "bg-emerald-50 text-emerald-950 font-black border border-emerald-200 hover:bg-emerald-100"
                          : isToday
                            ? "bg-slate-100 text-slate-900 border border-slate-300"
                            : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{day}</span>
                    {hasEvent && !isSelected && (
                      <span className="size-1.5 rounded-full bg-emerald-600 absolute bottom-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend Note */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <span className="size-2 rounded-full bg-emerald-600 inline-block shrink-0" />
            <span>Activity scheduled</span>
          </div>
        </Card>

        {/* RIGHT COLUMN: Activities List */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {tab} Activities
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {filteredSchedules.length}{" "}
                {filteredSchedules.length === 1 ? "activity" : "activities"} found
              </p>
            </div>

            {selectedDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDateFilter(null)}
                className="text-xs text-slate-500 hover:text-slate-900 font-bold"
              >
                Clear date filter
              </Button>
            )}
          </div>

          {/* Schedule Row Cards */}
          {filteredSchedules.length > 0 ? (
            <div className="space-y-3">
              {filteredSchedules.map((s) => {
                const dateObj = new Date(`${s.date}T12:00:00`);
                const dayStr = dateObj.toLocaleDateString("en-US", { day: "2-digit" });
                const monthStr = dateObj
                  .toLocaleDateString("en-US", { month: "short" })
                  .toUpperCase();

                const isUpcomingStatus = s.status === "Upcoming";
                const isClosed = s.status === "Closed";
                const isCancelled = s.status === "Cancelled";

                return (
                  <Card
                    key={s.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Date Block */}
                      <div className="size-13 sm:size-14 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col items-center justify-center text-center shrink-0 shadow-2xs">
                        <b className="text-lg sm:text-xl font-black text-emerald-950 leading-none">
                          {dayStr}
                        </b>
                        <span className="text-[10px] font-black uppercase text-emerald-700 leading-none mt-1">
                          {monthStr}
                        </span>
                      </div>

                      {/* Picture Thumbnail (if available) */}
                      {s.cover_image ? (
                        <div className="size-13 sm:size-14 rounded-2xl overflow-hidden border border-slate-200 shrink-0 relative bg-slate-100 shadow-2xs">
                          <Image
                            src={programImageUrl(s.cover_image)}
                            alt={s.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : null}

                      {/* Schedule Info */}
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <Badge
                            className={`text-[10px] font-black uppercase px-2 py-0.5 ${
                              isUpcomingStatus
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : isClosed
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : isCancelled
                                    ? "bg-rose-100 text-rose-800 border-rose-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {s.status}
                          </Badge>
                          <span className="rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 border border-slate-200/60">
                            {s.type}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {s.name}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock3 className="size-3.5 text-slate-400" />
                            {formatTime(s.start)} – {formatTime(s.end)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5 text-slate-400" />
                            {s.location}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 font-semibold flex items-center gap-1 pt-0.5">
                          <Users className="size-3.5 text-emerald-700" />
                          <span>{s.participants} farmers participating</span>
                        </p>
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="self-end sm:self-center shrink-0 w-full sm:w-auto pt-2 sm:pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setSelectedSchedule(s)}
                        className="w-full sm:w-auto h-9 sm:h-10 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-[#1E3A2F] hover:text-white text-slate-800 border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
                      >
                        <Eye className="size-3.5 mr-1.5" />
                        View Details
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-2xs">
              <div className="mx-auto size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <CalendarIcon className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                No {tab.toLowerCase()} activities
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto font-medium">
                Activities will appear here after they are saved.
              </p>
              <Button
                type="button"
                onClick={() => {
                  setEditTarget(null);
                  setView("schedule-form");
                }}
                className="mt-4 rounded-xl text-xs font-bold bg-[#1E3A2F] text-white hover:bg-[#152e24]"
              >
                <Plus className="size-3.5 mr-1" /> Create Activity
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Details Dialog */}
      <ScheduleDetailDialog
        schedule={selectedSchedule}
        bookings={bookings}
        open={selectedSchedule !== null}
        onClose={() => setSelectedSchedule(null)}
        onEdit={(item) => {
          setSelectedSchedule(null);
          setEditTarget(item);
          setView("schedule-form");
        }}
        onToggleStatus={handleToggleStatus}
        onDelete={(item) => {
          setDeleteTarget(item);
        }}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? Any associated
              farmer reservations will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchedule}
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </main>
    </>
  );
}

// ── ScheduleForm Component ────────────────────────────────────────────────

interface ScheduleFormProps {
  current?: ScheduleItem;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  isOnline: boolean;
  hasPublishedAnnouncement: boolean;
  assignedBarangayId?: number | null;
}

function ScheduleForm({
  current,
  onCancel,
  onSaved,
  isOnline,
  hasPublishedAnnouncement,
  assignedBarangayId,
}: ScheduleFormProps) {
  const draftStorageKey = "sibat-schedule-draft";

  // Form State
  const [form, setForm] = useState<{
    name: string;
    type: string;
    date: string;
    start: string;
    end: string;
    location: string;
    notes: string;
    description: string;
  }>(() => {
    if (current) {
      return {
        name: current.name,
        type: current.type,
        date: current.date,
        start: current.start,
        end: current.end,
        location: current.location,
        notes: current.notes,
        description: current.description,
      };
    }
    // Read from localStorage draft if available
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}

    return {
      name: "",
      type: "Vaccination",
      date: "",
      start: "08:00",
      end: "12:00",
      location: "",
      notes: "",
      description: "",
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(() => current?.raw?.cover_image || "");
  const [removeCover, setRemoveCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Picture must be 8 MB or smaller.");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview("");
    setRemoveCover(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Sync draft to localStorage when creating new
  useEffect(() => {
    if (!current && typeof localStorage !== "undefined") {
      localStorage.setItem(draftStorageKey, JSON.stringify(form));
    }
  }, [current, form]);

  const handleChange = (key: keyof typeof form, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "Enter an activity name.";
    if (!form.date) nextErrors.date = "Select an activity date.";
    if (!form.start) nextErrors.start = "Select a start time.";
    if (!form.location.trim()) nextErrors.location = "Enter the barangay or activity location.";
    if (!form.description.trim())
      nextErrors.description = "Enter a short description or instruction.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstField = Object.keys(nextErrors)[0];
      document.getElementById(`schedule-${firstField}`)?.focus();
      return;
    }

    if (!isOnline) {
      toast.warning("You are offline. Your draft is saved on this device. Reconnect to submit it.");
      return;
    }

    try {
      setSaving(true);
      // Map to API category
      let category = "OTHER";
      if (form.type === "Vaccination") category = "VACCINATION";
      else if (form.type === "Deworming" || form.type === "Vitamin Supplementation")
        category = "ANIMAL_HEALTH";

      const times = [form.start];
      if (form.end && form.end !== form.start) times.push(form.end);

      const payload = {
        program: form.name.trim(),
        description: form.description.trim(),
        objectives: form.type, // Store the specific type in objectives
        category,
        date: form.date,
        location: form.location.trim(),
        farmer_notes: form.notes.trim(),
        capacity: 50,
        available_times: times,
        registration_opens: null,
        registration_deadline: null,
        eligibility: "",
        contact_information: "",
        barangay: assignedBarangayId ?? null,
        publication_status: "PUBLISHED" as const,
      };

      let body: FormData | typeof payload = payload;
      if (coverFile || removeCover) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (key === "available_times" && Array.isArray(value)) {
            value.forEach((time) => formData.append(key, time));
          } else if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          } else if (value === null) {
            formData.append(key, "");
          }
        });
        if (coverFile) {
          formData.append("cover_image", coverFile);
        }
        if (removeCover) {
          formData.append("remove_cover_image", "true");
        }
        body = formData;
      }

      if (current && current.raw) {
        await api.patch(`/community/schedules/${current.raw.id}/`, body);
        toast.success("Schedule changes saved.");
      } else {
        await api.post("/community/schedules/", body);
        toast.success("New schedule saved and added to the activity list.");
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(draftStorageKey);
        }
      }

      await onSaved();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Header */}
      <PageHeader
        title={current ? "Edit Schedule" : "Create a New Schedule"}
        subtitle="Enter the activity details below. Fields marked Required must be completed."
        icon={<CalendarDays className="size-5 text-white" />}
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs sm:text-sm px-3.5 py-2 shrink-0 flex items-center gap-1.5 backdrop-blur-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> Back to Schedules
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-[900px] min-w-0 space-y-5 px-3.5 py-4 sm:p-6">

      <form onSubmit={handleSave}>
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-6">
          {/* Warning Strip if published announcement */}
          {current && hasPublishedAnnouncement && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-950 flex items-start gap-3">
              <Megaphone className="size-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <b className="font-bold">This activity has a published announcement</b>
                <p className="mt-0.5 text-xs text-amber-900 leading-relaxed">
                  After saving schedule changes, review and update the announcement so farmers
                  receive the correct details.
                </p>
              </div>
            </div>
          )}

          {/* Draft Note when creating */}
          {!current && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 flex items-center gap-2.5">
              <Check className="size-4 text-emerald-700 shrink-0" />
              <span>Your unfinished schedule is saved on this device.</span>
            </div>
          )}

          {/* SECTION 1: Activity Details */}
          <div className="space-y-4 pt-1">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-base font-bold text-slate-900">Activity Details</h2>
              <p className="text-xs text-slate-500">Use a clear name that farmers will understand.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Activity Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="schedule-name"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  Activity Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="schedule-name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Example: Banaba Cattle Vaccination"
                  className={`rounded-xl h-10 text-xs sm:text-sm ${
                    errors.name ? "border-rose-400 focus-visible:ring-rose-200" : ""
                  }`}
                />
                {errors.name && <p className="text-[11px] font-bold text-rose-600">{errors.name}</p>}
              </div>

              {/* Activity Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  Activity Type <span className="text-rose-500">*</span>
                </label>
                <Select value={form.type} onValueChange={(val) => handleChange("type", val)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm border-slate-200 bg-slate-50/60">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Date and Time */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-base font-bold text-slate-900">Date and Time</h2>
              <p className="text-xs text-slate-500">Check the date and time carefully before saving.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label
                  htmlFor="schedule-date"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  className={`rounded-xl h-10 text-xs sm:text-sm ${
                    errors.date ? "border-rose-400 focus-visible:ring-rose-200" : ""
                  }`}
                />
                {errors.date && <p className="text-[11px] font-bold text-rose-600">{errors.date}</p>}
              </div>

              {/* Start Time */}
              <div className="space-y-1.5">
                <label
                  htmlFor="schedule-start"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  Start Time <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="schedule-start"
                  type="time"
                  value={form.start}
                  onChange={(e) => handleChange("start", e.target.value)}
                  className={`rounded-xl h-10 text-xs sm:text-sm ${
                    errors.start ? "border-rose-400 focus-visible:ring-rose-200" : ""
                  }`}
                />
                {errors.start && (
                  <p className="text-[11px] font-bold text-rose-600">{errors.start}</p>
                )}
              </div>

              {/* End Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">End Time (Optional)</label>
                <Input
                  type="time"
                  value={form.end}
                  onChange={(e) => handleChange("end", e.target.value)}
                  className="rounded-xl h-10 text-xs sm:text-sm border-slate-200"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Location and Instructions */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-base font-bold text-slate-900">Location and Instructions</h2>
              <p className="text-xs text-slate-500">Provide clear venue details for attending farmers.</p>
            </div>

            <div className="space-y-4">
              {/* Location */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="schedule-location"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1"
                  >
                    Location or Barangay <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Enter a place farmers can easily find.</span>
                </div>
                <Input
                  id="schedule-location"
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="Example: Banaba Covered Court"
                  className={`rounded-xl h-10 text-xs sm:text-sm ${
                    errors.location ? "border-rose-400 focus-visible:ring-rose-200" : ""
                  }`}
                />
                {errors.location && (
                  <p className="text-[11px] font-bold text-rose-600">{errors.location}</p>
                )}
              </div>

              {/* Relevant Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Relevant Notes</label>
                  <span className="text-[11px] text-slate-400">Optional</span>
                </div>
                <Input
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="What should farmers bring? (e.g. Bring registration ID, leash)"
                  className="rounded-xl h-10 text-xs sm:text-sm border-slate-200"
                />
              </div>

              {/* Description or Instructions */}
              <div className="space-y-1.5">
                <label
                  htmlFor="schedule-description"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  Description or Instructions <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  id="schedule-description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Explain who can join, target livestock types, and what procedures will take place."
                  className={`rounded-xl text-xs sm:text-sm ${
                    errors.description ? "border-rose-400 focus-visible:ring-rose-200" : ""
                  }`}
                />
                {errors.description && (
                  <p className="text-[11px] font-bold text-rose-600">{errors.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Activity Picture / Banner */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-base font-bold text-slate-900">Activity Picture (Optional)</h2>
              <p className="text-xs text-slate-500">
                Upload a photo or banner to help farmers easily recognize this program.
              </p>
            </div>

            <div className="space-y-3">
              {coverPreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 group">
                  <div className="h-44 sm:h-52 w-full relative">
                    <Image
                      src={programImageUrl(coverPreview)}
                      alt="Activity preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl text-xs font-bold bg-white/90 hover:bg-white text-slate-700 shadow-sm backdrop-blur-xs cursor-pointer"
                    >
                      <Camera className="size-3.5 mr-1 text-emerald-700" />
                      Change Picture
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveCover}
                      className="rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-emerald-50/20 p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <div className="size-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-emerald-700 group-hover:border-emerald-200 shadow-2xs transition-colors mb-2.5">
                    <Upload className="size-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-900">
                    Upload activity photo or banner
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    PNG, JPG, or WebP up to 8 MB. High-resolution landscape photos recommended.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3.5 rounded-xl text-xs font-bold border-slate-200 bg-white group-hover:border-emerald-300 pointer-events-none"
                  >
                    <Camera className="size-3.5 mr-1 text-emerald-700" /> Choose Photo
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
              className="rounded-xl px-5 text-xs font-bold border-slate-200 text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl px-6 text-xs font-bold bg-[#1E3A2F] text-white hover:bg-[#152e24] shadow-xs cursor-pointer"
            >
              {saving ? "Saving…" : current ? "Save Changes" : "Save Schedule"}
            </Button>
          </div>
        </Card>
      </form>
      </main>
    </>
  );
}

// ── ScheduleDetailDialog Component ────────────────────────────────────────

interface ScheduleDetailDialogProps {
  schedule: ScheduleItem | null;
  bookings: ProgramBooking[];
  open: boolean;
  onClose: () => void;
  onEdit: (item: ScheduleItem) => void;
  onToggleStatus: (item: ScheduleItem) => Promise<void>;
  onDelete: (item: ScheduleItem) => void;
}

function ScheduleDetailDialog({
  schedule,
  bookings,
  open,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
}: ScheduleDetailDialogProps) {
  if (!schedule) return null;

  const relevantBookings = bookings.filter(
    (b) => b.schedule === schedule.raw?.id && b.status === "CONFIRMED"
  );
  const isOpen = schedule.raw?.is_open ?? true;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
              {schedule.type}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-bold">
              {schedule.status}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight pt-1">
            {schedule.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Activity scheduled for {new Date(`${schedule.date}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Cover Picture Banner (if present) */}
        {schedule.cover_image ? (
          <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-slate-200 shadow-2xs my-2">
            <Image
              src={programImageUrl(schedule.cover_image)}
              alt={schedule.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-4 py-2 text-xs">
          {/* Key Info Strip */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Time Window
              </span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <Clock3 className="size-3.5 text-slate-400" />
                {formatTime(schedule.start)} – {formatTime(schedule.end)}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Location
              </span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                <MapPin className="size-3.5 text-slate-400 shrink-0" />
                {schedule.location}
              </p>
            </div>
          </div>

          {/* Description */}
          {schedule.description && (
            <div className="space-y-1">
              <h4 className="font-bold text-slate-700">Instructions & Description</h4>
              <p className="text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                {schedule.description}
              </p>
            </div>
          )}

          {/* Notes */}
          {schedule.notes && (
            <div className="space-y-1">
              <h4 className="font-bold text-slate-700">Relevant Notes for Farmers</h4>
              <p className="text-amber-900 bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
                {schedule.notes}
              </p>
            </div>
          )}

          {/* Registered Farmers List */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="size-4 text-emerald-700" />
                Registered Farmers ({relevantBookings.length})
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Capacity: {schedule.raw?.capacity || 50} slots
              </span>
            </div>

            {relevantBookings.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {relevantBookings.map((b) => (
                  <div key={b.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900">{b.farmer_name}</p>
                      <p className="text-[10px] text-slate-400">
                        {b.farmer_barangay || "Padre Garcia"} • Appt: {formatTime(b.time)}
                      </p>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                      Confirmed
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 py-3 text-center italic">
                No farmer bookings recorded yet for this session.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDelete(schedule)}
              className="rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <Trash2 className="size-3.5 mr-1" /> Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggleStatus(schedule)}
              className="rounded-xl text-xs font-bold border-slate-200"
            >
              {isOpen ? "Close Registrations" : "Reopen Registrations"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs font-bold border-slate-200"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => onEdit(schedule)}
              className="rounded-xl text-xs font-bold bg-[#1E3A2F] text-white hover:bg-[#152e24]"
            >
              <Pencil className="size-3.5 mr-1.5" /> Edit Activity
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}