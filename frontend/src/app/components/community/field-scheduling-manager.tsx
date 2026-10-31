"use client";

import { PageHeader } from "@/app/components/page-header";
import {
AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,
AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar,CalendarDayButton } from "@/components/ui/calendar";
import { Card,CardContent,CardDescription,CardTitle } from "@/components/ui/card";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Progress } from "@/components/ui/progress";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { apiError,getBarangays,getBookings,getSchedules,type BarangayOption,type ProgramBooking,type ProgramFarmerAudience,type ProgramPublicationStatus,type ProgramSchedule } from "@/lib/community-api";
import { ArrowLeft,CalendarDays,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,ClipboardList,Clock3,FileText,GraduationCap,HeartPulse,Image as ImageIcon,Info,LockKeyhole,MapPin,Pencil,Plus,RefreshCw,Search,Settings,Sparkles,Trash2,UnlockKeyhole,Users,Zap } from "lucide-react";
import Image from "next/image";
import { useCallback,useEffect,useMemo,useRef,useState,type FormEvent } from "react";
import { CommunityEmptyState,CommunitySkeleton,formatLongDate,formatTime,PROGRAM_TIME_SLOTS,todayIso,type CommunityRole } from "./community-ui";

type ManagerRole = Extract<CommunityRole, "admin" | "sibat">;
type ScheduleAction = "close" | "reopen" | "delete" | "publish" | "unpublish" | "cancel" | "complete";
type PendingAction = { schedule: ProgramSchedule; action: ScheduleAction };
type ScheduleForm = { date: string; program: string; description: string; objectives: string; category: ProgramSchedule["category"]; location: string; farmer_notes: string; capacity: string; available_times: string[]; registration_opens: string; registration_deadline: string; eligibility: string; contact_information: string; barangay: string; farmer_audience: ProgramFarmerAudience; publication_status: ProgramPublicationStatus };
type SchedulePayload = Omit<ScheduleForm, "capacity" | "barangay" | "registration_opens" | "registration_deadline"> & { capacity: number; barangay: number | null; registration_opens: string | null; registration_deadline: string | null };
const emptyForm: ScheduleForm = { date: "", program: "", description: "", objectives: "", category: "OTHER", location: "", farmer_notes: "", capacity: "4", available_times: [...PROGRAM_TIME_SLOTS], registration_opens: "", registration_deadline: "", eligibility: "", contact_information: "", barangay: "", farmer_audience: "ALL_FARMERS", publication_status: "PUBLISHED" };

function localTimeNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function timesInWindow(start: string, end: string, availableTimes: readonly string[] = PROGRAM_TIME_SLOTS): string[] {
  if (!start || !end || end < start) return [];
  return [...new Set([start, end, ...availableTimes.filter((time) => time >= start && time <= end)])].sort();
}

function coverPreviewUrl(path: string): string {
  if (path.startsWith("blob:")) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${(api.defaults.baseURL || "").replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function localDateFromIso(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromLocalDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function ProgramCalendarDayButton(props: React.ComponentProps<typeof CalendarDayButton>) {
  return (
    <CalendarDayButton {...props}>
      {props.children}
      {props.modifiers.programDate ? <span aria-hidden="true" className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current opacity-80" /> : null}
    </CalendarDayButton>
  );
}

function formatProgramTableDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatProgramTimeWindow(availableTimes?: readonly string[]): string {
  const times = availableTimes?.length ? [...availableTimes].sort() : [];
  if (!times.length) return "8:00 AM - 5:00 PM";
  if (times.length === 1) return formatTime(times[0]);
  return `${formatTime(times[0])} - ${formatTime(times[times.length - 1])}`;
}

function getCategoryIconConfig(category: ProgramSchedule["category"], programTitle: string) {
  const title = (programTitle || "").toLowerCase();
  if (category === "VACCINATION" || title.includes("vaccin")) {
    return {
      container: "bg-blue-100/70 text-blue-600 border border-blue-200/60",
      icon: <CalendarDays className="size-5 text-blue-600" />,
    };
  }
  if (title.includes("deworm") || title.includes("parasite")) {
    return {
      container: "bg-amber-100/70 text-amber-700 border border-amber-200/60",
      icon: <Sparkles className="size-5 text-amber-700" />,
    };
  }
  if (category === "ANIMAL_HEALTH" || title.includes("health") || title.includes("check")) {
    return {
      container: "bg-rose-100/70 text-rose-600 border border-rose-200/60",
      icon: <HeartPulse className="size-5 text-rose-600" />,
    };
  }
  if (category === "SEMINAR" || title.includes("seminar") || title.includes("train")) {
    return {
      container: "bg-violet-100/70 text-violet-600 border border-violet-200/60",
      icon: <GraduationCap className="size-5 text-violet-600" />,
    };
  }
  if (category === "CENSUS") {
    return {
      container: "bg-emerald-100/70 text-emerald-700 border border-emerald-200/60",
      icon: <ClipboardList className="size-5 text-emerald-700" />,
    };
  }
  return {
    container: "bg-emerald-100/70 text-emerald-700 border border-emerald-200/60",
    icon: <CalendarDays className="size-5 text-emerald-700" />,
  };
}

function renderProgramStatusBadge(schedule: ProgramSchedule) {
  if (schedule.publication_status === "CANCELLED" || schedule.registration_status === "CANCELLED") {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/60 whitespace-nowrap">
        Cancelled
      </span>
    );
  }
  if (
    schedule.publication_status === "COMPLETED" ||
    schedule.registration_status === "COMPLETED" ||
    schedule.date < todayIso()
  ) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200/60 whitespace-nowrap">
        Completed
      </span>
    );
  }
  if (schedule.date === todayIso()) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 whitespace-nowrap">
        Ongoing Today
      </span>
    );
  }
  if (schedule.is_open && schedule.registration_status === "AVAILABLE") {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
        Registration Open
      </span>
    );
  }
  if (schedule.registration_status === "FULL") {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/60 whitespace-nowrap">
        Full
      </span>
    );
  }
  if (schedule.publication_status === "DRAFT") {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
      Registration Closed
    </span>
  );
}

export function FieldSchedulingManager({ role }: { role: ManagerRole }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [programErrorMessage, setProgramErrorMessage] = useState("");
  const [canRetryProgramLoad, setCanRetryProgramLoad] = useState(false);
  const [programsLoadFailed, setProgramsLoadFailed] = useState(false);
  const [saveSuccessDialog, setSaveSuccessDialog] = useState<{ title: string; description: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramSchedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [startTime, setStartTime] = useState<string>(PROGRAM_TIME_SLOTS[0]);
  const [endTime, setEndTime] = useState<string>(PROGRAM_TIME_SLOTS[PROGRAM_TIME_SLOTS.length - 1]);
  const [selected, setSelected] = useState<ProgramSchedule | null>(null);
  const [showBookingsRoster, setShowBookingsRoster] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [conflictPayload, setConflictPayload] = useState<SchedulePayload | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [removeCover, setRemoveCover] = useState(false);
  const [search, setSearch] = useState("");
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "ongoing" | "completed" | "cancelled">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedScheduleId, setHighlightedScheduleId] = useState<number | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<number | null>(null);
  const [notificationBookingId, setNotificationBookingId] = useState<number | null>(null);
  const [pendingScrollScheduleId, setPendingScrollScheduleId] = useState<number | null>(null);
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<Set<number>>(() => new Set());
  const scrolledScheduleId = useRef<number | null>(null);
  const handledBookingId = useRef<number | null>(null);

  const toggleExpandedSchedule = (id: number) => {
    setExpandedScheduleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (pendingScrollScheduleId !== null) {
      setExpandedScheduleIds((prev) => new Set(prev).add(pendingScrollScheduleId));
    }
  }, [pendingScrollScheduleId]);

  const showErrorDialog = useCallback((message: string, canRetryLoad = false) => {
    setProgramErrorMessage(message);
    setCanRetryProgramLoad(canRetryLoad);
  }, []);

  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get("bookingId"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Number.isInteger(value) && value > 0) setNotificationBookingId(value);
  }, []);

  const load = useCallback(async () => {
    try {
      const [schedulesResult, bookingsResult, barangaysResult] = await Promise.allSettled([
        getSchedules(),
        getBookings(),
        getBarangays(),
      ]);

      if (schedulesResult.status === "fulfilled") {
        setSchedules(schedulesResult.value);
        setProgramsLoadFailed(false);
        setProgramErrorMessage("");
        setCanRetryProgramLoad(false);
      } else {
        setProgramsLoadFailed(true);
        showErrorDialog(apiError(schedulesResult.reason), true);
      }
      if (bookingsResult.status === "fulfilled") {
        setBookings(bookingsResult.value);
      }
      if (barangaysResult.status === "fulfilled") setBarangays(barangaysResult.value);

      if (bookingsResult.status === "rejected") {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[FieldSchedulingManager] Bookings load warning:", bookingsResult.reason);
        }
      }
    } catch (e) {
      setProgramsLoadFailed(true);
      showErrorDialog(apiError(e), true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showErrorDialog]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    // The asynchronous requests update state when they finish.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (pendingScrollScheduleId === null || scrolledScheduleId.current === pendingScrollScheduleId) return;
    const card = document.getElementById(`program-schedule-${pendingScrollScheduleId}`);
    if (!card) return;

    card.scrollIntoView({ behavior: "smooth", block: "center" });
    scrolledScheduleId.current = pendingScrollScheduleId;
  }, [pendingScrollScheduleId, schedules]);

  useEffect(() => {
    if (
      notificationBookingId === null ||
      loading ||
      handledBookingId.current === notificationBookingId
    ) return;

    const booking = bookings.find((item) => item.id === notificationBookingId);
    const schedule = booking && schedules.find((item) => item.id === booking.schedule);
    if (!booking || !schedule) {
      handledBookingId.current = notificationBookingId;
      return;
    }

    handledBookingId.current = notificationBookingId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(schedule);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedBookingId(booking.id);

    const url = new URL(window.location.href);
    url.searchParams.delete("bookingId");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [notificationBookingId, bookings, schedules, loading]);

  const bookingsBySchedule = useMemo(() => {
    const grouped = new Map<number, ProgramBooking[]>();
    for (const booking of bookings) {
      const rows = grouped.get(booking.schedule) ?? [];
      rows.push(booking);
      grouped.set(booking.schedule, rows);
    }
    return grouped;
  }, [bookings]);

  // The bookings endpoint retains rows for soft-deleted programs so history stays intact.
  // Scheduling KPIs should only count bookings attached to schedules still in the registry.
  const visibleScheduleIds = useMemo(
    () => new Set(schedules.map((schedule) => schedule.id)),
    [schedules],
  );
  const visibleConfirmedBookings = bookings.filter(
    (booking) => booking.status === "CONFIRMED" && visibleScheduleIds.has(booking.schedule),
  );
  const confirmedCount = visibleConfirmedBookings.length;
  const openCount = schedules.filter(
    (schedule) =>
      schedule.is_open &&
      schedule.registration_status !== "CANCELLED" &&
      schedule.registration_status !== "COMPLETED" &&
      schedule.date >= todayIso(),
  ).length;
  const ongoingTodayCount = schedules.filter(
    (schedule) => schedule.date === todayIso() && schedule.publication_status !== "CANCELLED",
  ).length;
  const completedCount = schedules.filter(
    (schedule) =>
      schedule.publication_status === "COMPLETED" ||
      schedule.registration_status === "COMPLETED" ||
      (schedule.date < todayIso() && schedule.publication_status !== "CANCELLED"),
  ).length;
  const uniqueFarmers = new Set(visibleConfirmedBookings.map((booking) => booking.farmer_name)).size;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, calendarDate]);

  function startCreate() {
    setEditing(null);
    const canChooseBarangay = role === "admin" || user?.accessScope === "ALL_BARANGAYS";
    setForm({ ...emptyForm, available_times: [...PROGRAM_TIME_SLOTS], barangay: canChooseBarangay ? "" : String(user?.assignedBarangayId ?? ""), farmer_audience: role === "admin" || canChooseBarangay ? "ALL_FARMERS" : "BARANGAY_ONLY" });
    setStartTime(PROGRAM_TIME_SLOTS[0]);
    setEndTime(PROGRAM_TIME_SLOTS[PROGRAM_TIME_SLOTS.length - 1]);
    setCoverFile(null);
    setCoverPreview("");
    setRemoveCover(false);
    setFormOpen(true);
  }

  function startEdit(schedule: ProgramSchedule) {
    setEditing(schedule);
    const scheduleTimes = [...(schedule.available_times?.length ? schedule.available_times : PROGRAM_TIME_SLOTS)].sort();
    setStartTime(scheduleTimes[0]);
    setEndTime(scheduleTimes[scheduleTimes.length - 1]);
    setForm({ ...emptyForm, date: schedule.date, program: schedule.program, description: schedule.description || "", objectives: schedule.objectives || "", category: schedule.category || "OTHER", location: schedule.location, farmer_notes: schedule.farmer_notes || "", capacity: String(schedule.capacity), available_times: scheduleTimes, registration_opens: schedule.registration_opens || "", registration_deadline: schedule.registration_deadline || "", eligibility: schedule.eligibility || "", contact_information: schedule.contact_information || "", barangay: schedule.barangay ? String(schedule.barangay) : "", farmer_audience: role === "admin" ? "ALL_FARMERS" : schedule.farmer_audience || (schedule.barangay ? "BARANGAY_ONLY" : "ALL_FARMERS"), publication_status: schedule.publication_status || "PUBLISHED" });
    setCoverFile(null);
    setCoverPreview(schedule.cover_image || "");
    setRemoveCover(false);
    setFormOpen(true);
  }

  async function persistSchedule(payload: SchedulePayload) {
    const isCreating = editing === null;
    setBusy(true);
    setProgramErrorMessage("");
    setCanRetryProgramLoad(false);
    const requestPayload: Partial<SchedulePayload> = { ...payload };
    // The API rejects edits that submit a historical date. Keep it fixed while allowing other details to change.
    if (editing && editing.date < todayIso() && payload.date === editing.date) delete requestPayload.date;
    try {
      let body: FormData | Partial<SchedulePayload> = requestPayload;
      if (coverFile || removeCover) {
        const formData = new FormData();
        Object.entries(requestPayload).forEach(([key, value]) => {
          if (key === "available_times" && Array.isArray(value)) value.forEach((time) => formData.append(key, time));
          else if (value !== undefined && value !== null) formData.append(key, String(value));
          else if (value === null) formData.append(key, "");
        });
        if (coverFile) formData.append("cover_image", coverFile);
        if (removeCover) formData.append("remove_cover_image", "true");
        body = formData;
      }
      let createdScheduleId: number | null = null;
      if (editing) {
        await api.patch(`/community/schedules/${editing.id}/`, body);
      } else {
        const { data: createdSchedule } = await api.post<ProgramSchedule>("/community/schedules/", body);
        createdScheduleId = createdSchedule.id;
      }
      setConflictPayload(null);
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setCoverFile(null);
      setCoverPreview("");
      setRemoveCover(false);
      if (isCreating && createdScheduleId !== null) {
        setFilter("all");
        setSearch("");
        setCalendarDate(null);
        setHighlightedScheduleId(createdScheduleId);
        setPendingScrollScheduleId(createdScheduleId);
      }
      setSaveSuccessDialog({
        title: isCreating ? "Program Saved!" : "Program Updated!",
        description: `${payload.program} · ${formatLongDate(payload.date)}`,
      });
    } catch (e) {
      const message = apiError(e);
      showErrorDialog(message);
    } finally {
      setBusy(false);
    }
  }

  async function continueAnyway() {
    if (!conflictPayload || busy) return;
    const payload = conflictPayload;
    setConflictPayload(null);
    await persistSchedule(payload);
  }

  function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProgramErrorMessage("");
    setCanRetryProgramLoad(false);
    const payload: SchedulePayload = { ...form, farmer_audience: role === "admin" ? "ALL_FARMERS" : form.farmer_audience, available_times: [...form.available_times].sort(), capacity: Number(form.capacity), program: form.program.trim(), description: form.description.trim(), objectives: form.objectives.trim(), location: form.location.trim(), farmer_notes: form.farmer_notes.trim(), eligibility: form.eligibility.trim(), contact_information: form.contact_information.trim(), registration_opens: form.registration_opens || null, registration_deadline: form.registration_deadline || null, barangay: form.barangay ? Number(form.barangay) : null };
    if (!payload.location) {
      showErrorDialog("Enter a venue or location before adding or saving the program.");
      return;
    }
    if (form.capacity.trim() === "" || !Number.isInteger(payload.capacity) || payload.capacity < 0 || payload.capacity > 10000) {
      showErrorDialog("Capacity must be unlimited or a whole number from 1 to 10,000.");
      return;
    }
    if (editing && payload.capacity > 0 && payload.capacity < editing.booking_count) {
      showErrorDialog(`Capacity cannot be lower than the ${editing.booking_count} confirmed bookings.`);
      return;
    }
    if (endTime < startTime) {
      showErrorDialog("The end time must be the same as or later than the start time.");
      return;
    }
    if (payload.available_times.length === 0) {
      showErrorDialog("Choose a valid start and end time for the activity.");
      return;
    }
    if (payload.farmer_audience === "BARANGAY_ONLY" && !payload.barangay) {
      showErrorDialog("Choose a program barangay when access is limited to farmers in that barangay.");
      return;
    }
    if (payload.date === todayIso()) {
      const now = localTimeNow();
      if (startTime <= now) {
        showErrorDialog("For today's activity, choose a start time later than the current time.");
        return;
      }
      const pastTimes = payload.available_times.filter(
        (time) => time <= now && !editing?.booked_times.includes(time),
      );
      if (pastTimes.length > 0) {
        showErrorDialog("For today's schedule, remove past appointment times and choose a later time.");
        return;
      }
    }
    const duplicateProgram = schedules.find((schedule) =>
      schedule.id !== editing?.id &&
      schedule.date === payload.date &&
      schedule.program.trim().toLocaleLowerCase() === payload.program.trim().toLocaleLowerCase()
    );
    if (duplicateProgram) {
      const message = `“${duplicateProgram.program}” is already scheduled on ${formatLongDate(duplicateProgram.date)}.`;
      showErrorDialog(message);
      return;
    }
    const normalizedLocation = payload.location.trim().toLocaleLowerCase();
    const overlappingSchedules = schedules.filter((schedule) =>
      schedule.id !== editing?.id &&
      schedule.date === payload.date &&
      normalizedLocation !== "" &&
      schedule.location.trim().toLocaleLowerCase() === normalizedLocation &&
      (schedule.available_times || PROGRAM_TIME_SLOTS).some((time) => payload.available_times.includes(time))
    );
    const unlimitedConflict = overlappingSchedules.find((schedule) => payload.capacity === 0 || schedule.capacity === 0);
    if (unlimitedConflict) {
      const message = "A no-limit program cannot overlap another program at the same venue and time.";
      showErrorDialog(message);
      return;
    }
    const conflict = overlappingSchedules[0];
    if (conflict) {
      setConflictPayload(payload);
      return;
    }
    void persistSchedule(payload);
  }

  async function performAction() {
    if (!pendingAction) return;
    const { schedule, action } = pendingAction;
    if (action === "delete" && (bookingsBySchedule.get(schedule.id)?.length ?? 0) > 0 && schedule.date >= todayIso()) return;
    setBusy(true);
    setProgramErrorMessage("");
    setCanRetryProgramLoad(false);
    try {
      if (action === "delete") await api.delete(`/community/schedules/${schedule.id}/`);
      else if (action === "close" || action === "reopen") await api.patch(`/community/schedules/${schedule.id}/`, { is_open: action === "reopen" });
      else {
        const publication_status = action === "publish" ? "PUBLISHED" : action === "unpublish" ? "DRAFT" : action === "cancel" ? "CANCELLED" : "COMPLETED";
        await api.patch(`/community/schedules/${schedule.id}/`, { publication_status, is_open: action === "publish" });
      }
      if (selected?.id === schedule.id && action === "delete") setSelected(null);
      setPendingAction(null);
      await refresh();
    } catch (e) {
      showErrorDialog(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const selectedBookings = selected ? (bookingsBySchedule.get(selected.id) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)) : [];
  const selectedHasBookingHistory = pendingAction ? (bookingsBySchedule.get(pendingAction.schedule.id)?.length ?? 0) > 0 : false;
  const selectedIsPast = pendingAction ? pendingAction.schedule.date < todayIso() : false;

  useEffect(() => {
    const targetBooking = bookings.find((booking) => booking.id === highlightedBookingId);
    if (highlightedBookingId === null || !selected || targetBooking?.schedule !== selected.id) return;
    const frame = window.requestAnimationFrame(() => {
      const isDesktop = window.matchMedia("(min-width: 640px)").matches;
      document.getElementById("program-booking-" + highlightedBookingId + "-" + (isDesktop ? "desktop" : "mobile"))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const clearHighlight = window.setTimeout(() => setHighlightedBookingId(null), 7000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clearHighlight);
    };
  }, [highlightedBookingId, selected, bookings]);
  const visibleSchedules = useMemo(() => {
    return schedules
      .filter((schedule) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          `${schedule.program} ${schedule.location} ${schedule.barangay_name || ""}`
            .toLowerCase()
            .includes(q);

        let matchesFilter = true;
        if (filter === "upcoming") {
          matchesFilter = schedule.date > todayIso() && schedule.publication_status !== "CANCELLED";
        } else if (filter === "ongoing") {
          matchesFilter = schedule.date === todayIso() && schedule.publication_status !== "CANCELLED";
        } else if (filter === "completed") {
          matchesFilter =
            schedule.publication_status === "COMPLETED" ||
            schedule.registration_status === "COMPLETED" ||
            (schedule.date < todayIso() && schedule.publication_status !== "CANCELLED");
        } else if (filter === "cancelled") {
          matchesFilter =
            schedule.publication_status === "CANCELLED" ||
            schedule.registration_status === "CANCELLED";
        }

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const dateComparison = b.date.localeCompare(a.date);
        if (dateComparison !== 0) return dateComparison;
        return b.id - a.id;
      });
  }, [schedules, search, filter]);

  const visibleProgramDates = useMemo(
    () => new Set(visibleSchedules.map((schedule) => schedule.date)),
    [visibleSchedules],
  );

  const displayedSchedules = useMemo(() => {
    return calendarDate
      ? visibleSchedules.filter((schedule) => schedule.date === isoFromLocalDate(calendarDate))
      : visibleSchedules;
  }, [visibleSchedules, calendarDate]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(displayedSchedules.length / pageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(displayedSchedules.length, startIndex + pageSize);
  const paginatedSchedules = displayedSchedules.slice(startIndex, endIndex);

  const accent = "bg-[#14532d] hover:bg-[#0f3d21]";
  const pageTitle = "Livestock Programs";

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle="Create and publish programs, manage registrations, and record farmer attendance."
        icon={<CalendarDays className="size-5 text-slate-800" />}
        variant={role}
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label="Refresh schedules"
              title="Refresh schedules"
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            >
              <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              type="button"
              onClick={startCreate}
              className="h-10 gap-2 rounded-xl px-4 text-xs sm:text-sm font-bold text-white shadow-xs bg-[#14532d] hover:bg-[#0f3d21]"
            >
              <Plus className="size-4" />
              <span>Create Program</span>
            </Button>
          </div>
        }
      />

      <div className={role === "sibat" ? "w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6" : "w-full space-y-4 p-3 sm:p-4 md:p-5"}>
        <div className="grid items-start gap-5 lg:grid-cols-[21rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* LEFT: Program Calendar */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs lg:sticky lg:top-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <CalendarDays className="size-5 text-[#14532d]" /> Program Calendar
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Select a highlighted date to filter programs.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#14532d]" /> {visibleProgramDates.size} dates
                </span>
                {calendarDate ? (
                  <button
                    type="button"
                    onClick={() => setCalendarDate(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                  >
                    Clear date
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mx-auto max-w-xl rounded-xl border border-slate-100 bg-slate-50/70 p-2 sm:p-3 lg:max-w-none">
              <Calendar
                mode="single"
                selected={calendarDate ?? undefined}
                onSelect={(day) => setCalendarDate(day ?? null)}
                components={{ DayButton: ProgramCalendarDayButton }}
                disabled={(day) => !visibleProgramDates.has(isoFromLocalDate(day))}
                modifiers={{ programDate: [...visibleProgramDates].map(localDateFromIso) }}
                modifiersClassNames={{ programDate: "bg-emerald-100 font-extrabold text-emerald-950 hover:bg-emerald-200" }}
                className="mx-auto w-full [--cell-size:2.5rem] sm:[--cell-size:2.75rem]"
                classNames={{
                  caption_label: "text-base font-extrabold text-slate-900",
                  weekday: "flex-1 text-center text-xs font-bold text-slate-500",
                  day_button: "mx-auto aspect-square h-auto max-h-(--cell-size) w-full max-w-(--cell-size) text-sm font-semibold",
                }}
              />
            </div>

            {calendarDate && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex items-center justify-between">
                <span>Filtered by: <strong>{formatProgramTableDate(isoFromLocalDate(calendarDate))}</strong></span>
                <button
                  type="button"
                  onClick={() => setCalendarDate(null)}
                  className="font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  Show all
                </button>
              </div>
            )}
          </section>

          {/* RIGHT: UI matching requested screenshot */}
          <div className="min-w-0 space-y-5">
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {/* Total Programs */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-4.5 shadow-xs flex items-center gap-3.5">
                <div className="size-11 sm:size-12 shrink-0 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                  <CalendarDays className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 truncate">Total Programs</p>
                  <p className="mt-0.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{schedules.length}</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">All scheduled programs</p>
                </div>
              </div>

              {/* Open for Registration */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-4.5 shadow-xs flex items-center gap-3.5">
                <div className="size-11 sm:size-12 shrink-0 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                  <Users className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 truncate">Open for Registration</p>
                  <p className="mt-0.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{openCount}</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">Farmers can still join</p>
                </div>
              </div>

              {/* Ongoing Today */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-4.5 shadow-xs flex items-center gap-3.5">
                <div className="size-11 sm:size-12 shrink-0 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                  <Clock3 className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 truncate">Ongoing Today</p>
                  <p className="mt-0.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{ongoingTodayCount}</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">Currently running</p>
                </div>
              </div>

              {/* Completed */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-4.5 shadow-xs flex items-center gap-3.5">
                <div className="size-11 sm:size-12 shrink-0 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <CheckCircle2 className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 truncate">Completed</p>
                  <p className="mt-0.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{completedCount}</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">Finished activities</p>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search programs..."
                  aria-label="Search programs"
                  className="h-10 sm:h-11 rounded-2xl border-slate-200 bg-white pl-10 text-sm shadow-xs focus-visible:ring-emerald-600"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Filter programs">
                {([
                  { key: "all", label: "All" },
                  { key: "upcoming", label: "Upcoming" },
                  { key: "ongoing", label: "Ongoing" },
                  { key: "completed", label: "Completed" },
                  { key: "cancelled", label: "Cancelled" },
                ] as const).map(({ key, label }) => {
                  const isActive = filter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`h-9 sm:h-10 rounded-xl px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#14532d] text-white shadow-xs"
                          : "border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Programs List */}
            {loading ? (
              <CommunitySkeleton cards={4} />
            ) : programsLoadFailed && schedules.length === 0 ? (
              <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-8">
                <Button type="button" variant="outline" onClick={() => void refresh()} disabled={refreshing}>
                  <RefreshCw className={`mr-2 size-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Retrying…" : "Retry loading programs"}
                </Button>
              </div>
            ) : schedules.length === 0 ? (
              <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
                <CardContent className="p-8">
                  <CommunityEmptyState
                    icon={<CalendarDays className="size-6" />}
                    title="No scheduled programs yet"
                    description="Create a program date to make appointment slots available for farmer registration."
                    action={
                      <Button
                        type="button"
                        onClick={startCreate}
                        className="mt-3 h-10 px-4 text-xs sm:text-sm font-bold text-white rounded-xl bg-[#14532d] hover:bg-[#0f3d21]"
                      >
                        <Plus className="mr-1.5 size-4" /> Create Program
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : displayedSchedules.length === 0 ? (
              <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
                <CardContent className="p-8">
                  <CommunityEmptyState
                    icon={<Search className="size-6" />}
                    title="No programs match"
                    description="Try another search or filter, or clear your date selection."
                    action={
                      (search || filter !== "all" || calendarDate) ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSearch("");
                            setFilter("all");
                            setCalendarDate(null);
                          }}
                          className="mt-3 h-9 px-3.5 text-xs font-bold rounded-xl"
                        >
                          Reset filters
                        </Button>
                      ) : undefined
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Table Header */}
                <div className="hidden lg:grid grid-cols-[minmax(220px,2fr)_minmax(130px,1.2fr)_minmax(130px,1.2fr)_minmax(160px,1.5fr)_minmax(140px,1.2fr)_minmax(90px,0.8fr)_36px] items-center gap-4 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span>Program Name</span>
                  <span>Date</span>
                  <span>Time</span>
                  <span>Location</span>
                  <span>Status</span>
                  <span>Registered</span>
                  <span className="sr-only">Actions</span>
                </div>

                {/* Rows matching screenshot */}
                <div className="space-y-3">
                  {paginatedSchedules.map((schedule) => {
                    const isRegistrationOpen = schedule.is_open && schedule.registration_status === "AVAILABLE";
                    const iconConfig = getCategoryIconConfig(schedule.category, schedule.program);

                    return (
                      <div
                        key={schedule.id}
                        id={`program-schedule-${schedule.id}`}
                        onClick={() => setSelected(schedule)}
                        className={`group cursor-pointer rounded-2xl border p-4 sm:p-4.5 transition-all duration-150 hover:shadow-md ${
                          schedule.id === highlightedScheduleId
                            ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-200 shadow-sm"
                            : isRegistrationOpen
                              ? "border-emerald-200/90 bg-emerald-50/20 hover:border-emerald-300 hover:bg-emerald-50/40"
                              : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Desktop Layout */}
                        <div className="hidden lg:grid grid-cols-[minmax(220px,2fr)_minmax(130px,1.2fr)_minmax(130px,1.2fr)_minmax(160px,1.5fr)_minmax(140px,1.2fr)_minmax(90px,0.8fr)_36px] items-center gap-4">
                          {/* Program Name with Icon */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`size-11 shrink-0 rounded-xl flex items-center justify-center ${iconConfig.container}`}>
                              {iconConfig.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">
                                {schedule.program}
                              </p>
                              {schedule.barangay_name && (
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {schedule.barangay_name}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Date */}
                          <div className="text-sm font-medium text-slate-700 whitespace-nowrap">
                            {formatProgramTableDate(schedule.date)}
                          </div>

                          {/* Time */}
                          <div className="text-sm font-medium text-slate-600 whitespace-nowrap">
                            {formatProgramTimeWindow(schedule.available_times)}
                          </div>

                          {/* Location */}
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {schedule.location || "Location not set"}
                          </div>

                          {/* Status Badge */}
                          <div>
                            {renderProgramStatusBadge(schedule)}
                          </div>

                          {/* Registered */}
                          <div className="text-sm font-bold text-slate-900 whitespace-nowrap">
                            {schedule.capacity === 0 ? `${schedule.booking_count} / ∞` : `${schedule.booking_count} / ${schedule.capacity}`}
                          </div>

                          {/* Chevron */}
                          <div className="flex justify-end">
                            <ChevronRight className="size-5 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>

                        {/* Mobile / Tablet Layout */}
                        <div className="lg:hidden flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${iconConfig.container}`}>
                                {iconConfig.icon}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                                  {schedule.program}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {formatProgramTableDate(schedule.date)}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0">
                              {renderProgramStatusBadge(schedule)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 text-slate-600 truncate">
                              <Clock3 className="size-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{formatProgramTimeWindow(schedule.available_times)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600 truncate">
                              <MapPin className="size-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{schedule.location || "Location not set"}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-xs font-semibold text-slate-700">
                            <span>
                              Registered: <strong className="text-slate-900">{schedule.capacity === 0 ? `${schedule.booking_count}` : `${schedule.booking_count} / ${schedule.capacity}`}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1 text-emerald-800 font-bold group-hover:translate-x-0.5 transition-transform">
                              View Details <ChevronRight className="size-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination matching screenshot */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                  <p className="text-xs sm:text-sm font-semibold text-slate-500">
                    {displayedSchedules.length === 0
                      ? "Showing 0 programs"
                      : `Showing ${startIndex + 1}-${endIndex} of ${displayedSchedules.length} program${displayedSchedules.length === 1 ? "" : "s"}`}
                  </p>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={clampedPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="size-8 sm:size-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>

                    {Array.from({ length: totalPages }).map((_, index) => {
                      const pageNum = index + 1;
                      const isCurrent = pageNum === clampedPage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`size-8 sm:size-9 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center transition-all ${
                            isCurrent
                              ? "bg-[#14532d] text-white shadow-xs"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={clampedPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="size-8 sm:size-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Program Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg rounded-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {editing ? "Edit Program" : "Create Program"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 font-medium">
              Set the program schedule, location, and maximum participants. Farmers will be able to book available time slots.
            </DialogDescription>
          </DialogHeader>

          <form id="schedule-form" onSubmit={saveSchedule} className="space-y-4 pt-1">
            {/* Section 1: Program Information */}
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Program Information</p>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-program">
                Program Title
                <Input
                  id="schedule-program"
                  required
                  maxLength={100}
                  value={form.program}
                  onChange={(event) => setForm({ ...form, program: event.target.value })}
                  placeholder="e.g. Cattle & Swine Vaccination Drive"
                  className="h-10 text-sm font-medium"
                />
              </label>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700">
                Program category
                <Select value={form.category} onValueChange={(value: ScheduleForm["category"]) => setForm({ ...form, category: value })}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VACCINATION">Vaccination</SelectItem>
                    <SelectItem value="ANIMAL_HEALTH">Animal health</SelectItem>
                    <SelectItem value="CENSUS">Livestock census</SelectItem>
                    <SelectItem value="SEMINAR">Seminar or training</SelectItem>
                    <SelectItem value="ASSISTANCE">Agricultural assistance</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-description">
                Description and objectives
                <Textarea id="schedule-description" rows={3} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What will farmers and their animals receive from this program?" className="text-sm font-medium" />
              </label>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-objectives">
                Objectives <span className="font-normal text-slate-400">(optional)</span>
                <Textarea id="schedule-objectives" rows={2} maxLength={3000} value={form.objectives} onChange={(event) => setForm({ ...form, objectives: event.target.value })} placeholder="Main goals of this activity" className="text-sm font-medium" />
              </label>
              <div className="space-y-2">
                <label htmlFor="program-cover" className="block text-xs sm:text-sm font-bold text-slate-700">Cover image or poster <span className="font-normal text-slate-400">(up to 8 MB)</span></label>
                {coverPreview ? <div className="relative overflow-hidden rounded-xl border border-slate-200"><Image src={coverPreviewUrl(coverPreview)} alt="Program cover preview" width={1200} height={400} unoptimized className="h-36 w-full object-cover" /><Button type="button" variant="outline" onClick={() => { setCoverFile(null); setCoverPreview(""); setRemoveCover(true); }} className="absolute right-2 top-2 h-8 bg-white/95 text-xs">Remove image</Button></div> : <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500"><ImageIcon className="size-5" /> No cover image selected</div>}
                <Input id="program-cover" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 8 * 1024 * 1024) { showErrorDialog("Choose an image that is 8 MB or smaller."); event.target.value = ""; return; } setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); setRemoveCover(false); }} className="h-10 text-xs" />
              </div>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700">
                Publication
                <Select value={form.publication_status} onValueChange={(value: ProgramPublicationStatus) => setForm({ ...form, publication_status: value })}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DRAFT">Save as draft</SelectItem><SelectItem value="PUBLISHED">Publish now</SelectItem></SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700">
                Farmer audience
                <Select value={form.farmer_audience} onValueChange={(value: ProgramFarmerAudience) => setForm({ ...form, farmer_audience: value })}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {role === "sibat" && <SelectItem value="BARANGAY_ONLY">Farmers in {barangays.find((barangay) => String(barangay.id) === form.barangay)?.barangay_name || user?.assignedBarangayName || "this barangay"}</SelectItem>}
                    <SelectItem value="ALL_FARMERS">All Barangays</SelectItem>
                  </SelectContent>
                </Select>
                <span className="block text-[11px] font-normal text-slate-500">Controls which farmers can see and book this program.</span>
              </label>
            </div>

            {/* Section 2: Schedule & Location */}
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Schedule & Location</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-date">
                  Date
                  <Input
                    id="schedule-date"
                    type="date"
                    required
                    value={form.date}
                    min={editing && editing.date < todayIso() ? undefined : todayIso()}
                    disabled={Boolean(editing && editing.date < todayIso())}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      const availableTimes = timesInWindow(startTime, endTime, editing?.available_times?.length ? editing.available_times : PROGRAM_TIME_SLOTS);
                      const nextTimes = nextDate === todayIso()
                        ? availableTimes.filter((time) => time > localTimeNow() || Boolean(editing?.booked_times.includes(time)))
                        : availableTimes;
                      setForm({ ...form, date: nextDate, available_times: nextTimes });
                    }}
                    className="h-10 text-sm font-medium"
                  />
                  {editing && editing.date < todayIso() ? (
                    <span className="block text-xs font-medium text-slate-400">Past dates cannot be altered.</span>
                  ) : null}
                </label>

                <div className="space-y-1.5 text-xs font-bold text-slate-700 sm:text-sm">
                  <label htmlFor="schedule-capacity-mode">Maximum Slots</label>
                  <Select
                    value={form.capacity === "0" ? "UNLIMITED" : "LIMITED"}
                    onValueChange={(value) => setForm({ ...form, capacity: value === "UNLIMITED" ? "0" : form.capacity === "0" ? "4" : form.capacity })}
                  >
                    <SelectTrigger id="schedule-capacity-mode" className="h-10 w-full text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIMITED">Set a maximum</SelectItem>
                      <SelectItem value="UNLIMITED">No limits</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.capacity !== "0" ? <Input
                    id="schedule-capacity"
                    type="number"
                    required
                    min={1}
                    max={10000}
                    step={1}
                    aria-label="Maximum number of program slots"
                    value={form.capacity}
                    onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                    className="h-10 text-sm font-medium"
                  /> : <p className="text-xs font-medium text-slate-500">Farmers can register without a slot cap.</p>}
                </div>
                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-opens">
                  Registration opens <span className="font-normal text-slate-400">(optional)</span>
                  <Input id="schedule-opens" type="date" max={form.date || undefined} value={form.registration_opens} onChange={(event) => setForm({ ...form, registration_opens: event.target.value })} className="h-10 text-sm font-medium" />
                </label>
                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-deadline">
                  Registration closes <span className="font-normal text-slate-400">(optional)</span>
                  <Input id="schedule-deadline" type="date" min={form.registration_opens || undefined} max={form.date || undefined} value={form.registration_deadline} onChange={(event) => setForm({ ...form, registration_deadline: event.target.value })} className="h-10 text-sm font-medium" />
                </label>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs font-bold text-slate-700">Activity Time</p>
                  <p className="mt-1 text-[11px] font-normal text-slate-500">Set the time window. Existing appointment choices within the window remain bookable, along with its start and end.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-xs font-bold text-slate-700" htmlFor="schedule-start-time">
                    Start Time
                    <Input id="schedule-start-time" type="time" step={60} required min={form.date === todayIso() ? localTimeNow() : undefined} max={endTime || undefined} value={startTime} onChange={(event) => {
                      const nextStart = event.target.value;
                      setStartTime(nextStart);
                      const times = timesInWindow(nextStart, endTime, editing?.available_times?.length ? editing.available_times : PROGRAM_TIME_SLOTS);
                      setForm({ ...form, available_times: form.date === todayIso() ? times.filter((time) => time > localTimeNow() || Boolean(editing?.booked_times.includes(time))) : times });
                    }} className="h-10 text-sm font-medium" />
                  </label>
                  <label className="block space-y-1.5 text-xs font-bold text-slate-700" htmlFor="schedule-end-time">
                    End Time
                    <Input id="schedule-end-time" type="time" step={60} required min={startTime || undefined} value={endTime} onChange={(event) => {
                      const nextEnd = event.target.value;
                      setEndTime(nextEnd);
                      const times = timesInWindow(startTime, nextEnd, editing?.available_times?.length ? editing.available_times : PROGRAM_TIME_SLOTS);
                      setForm({ ...form, available_times: form.date === todayIso() ? times.filter((time) => time > localTimeNow() || Boolean(editing?.booked_times.includes(time))) : times });
                    }} className="h-10 text-sm font-medium" />
                  </label>
                </div>
                {form.date === todayIso() ? (
                  <p className="text-[11px] font-medium text-amber-800">The activity start time must be later than {formatTime(localTimeNow())} today.</p>
                ) : null}
              </div>

              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-location">
                Venue
                <Input
                  id="schedule-location"
                  required
                  maxLength={200}
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="e.g. Municipal Agriculture Office, Padre Garcia"
                  className="h-10 text-sm font-medium"
                />
              </label>
              {role === "admin" || user?.accessScope === "ALL_BARANGAYS" ? (
                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700">
                  Program barangay
                  <Select value={form.barangay || "MUNICIPALITY"} onValueChange={(value) => setForm({ ...form, barangay: value === "MUNICIPALITY" ? "" : value })}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Choose coverage" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MUNICIPALITY">Municipality-wide</SelectItem>
                      {barangays.map((barangay) => <SelectItem key={barangay.id} value={String(barangay.id)}>{barangay.barangay_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              ) : <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Program barangay: {user?.assignedBarangayName || "Your assigned barangay"}</p>}
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-eligibility">
                Eligibility and instructions <span className="font-normal text-slate-400">(optional)</span>
                <Textarea id="schedule-eligibility" rows={2} maxLength={2000} value={form.eligibility} onChange={(event) => setForm({ ...form, eligibility: event.target.value })} placeholder="Who can join and what should participants bring?" className="text-sm font-medium" />
              </label>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-contact">
                Contact information <span className="font-normal text-slate-400">(optional)</span>
                <Input id="schedule-contact" maxLength={200} value={form.contact_information} onChange={(event) => setForm({ ...form, contact_information: event.target.value })} placeholder="Office or contact number" className="h-10 text-sm font-medium" />
              </label>

              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-farmer-notes">
                Reminders for Farmers <span className="font-normal text-slate-400">(optional)</span>
                <Textarea
                  id="schedule-farmer-notes"
                  maxLength={1000}
                  rows={3}
                  value={form.farmer_notes}
                  onChange={(event) => setForm({ ...form, farmer_notes: event.target.value })}
                  placeholder="e.g. Bring your vaccination card and arrive 15 minutes early."
                  className="min-h-24 resize-y text-sm font-medium"
                />
                <span className="block text-[11px] font-normal text-slate-500">These notes will be visible to farmers viewing this schedule.</span>
              </label>
            </div>
          </form>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              form="schedule-form"
              disabled={busy}
              className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-xs ${accent}`}
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Create Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Bookings / Program Details Dialog matching screenshot */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setShowBookingsRoster(false);
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-2xl space-y-4">
          {selected ? (
            <div className="space-y-4">
              {/* Header: Blue Icon + Title + Badges */}
              <div className="flex items-start gap-4">
                <div className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                  <CalendarDays className="size-7 sm:size-8 stroke-[1.8]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                      {selected.category.replaceAll("_", " ")}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                      {selected.publication_status === "PUBLISHED"
                        ? "Published"
                        : selected.publication_status.charAt(0) + selected.publication_status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <DialogHeader className="p-0 text-left">
                    <DialogTitle className="break-words text-2xl sm:text-3xl font-black tracking-tight text-slate-950 mt-1">
                      {selected.program}
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                      Activity scheduled for {formatProgramTableDate(selected.date)}
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>

              {/* 3-Column Info Box: Time window | Location | Registered */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-0 sm:divide-x sm:divide-slate-200/70 shadow-xs">
                {/* Time window */}
                <div className="flex items-center gap-3 sm:px-3 first:pl-1">
                  <Clock3 className="size-6 sm:size-7 text-blue-600 shrink-0 stroke-[1.8]" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">Time window</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5 whitespace-nowrap">
                      {formatProgramTimeWindow(selected.available_times)}
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3 sm:px-4">
                  <MapPin className="size-6 sm:size-7 text-blue-600 shrink-0 stroke-[1.8]" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">Location</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2 break-words">
                      {selected.location || "Location not set"}
                    </p>
                  </div>
                </div>

                {/* Registered */}
                <div className="flex items-center gap-3 sm:px-4">
                  <Users className="size-6 sm:size-7 text-blue-600 shrink-0 stroke-[1.8]" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">Registered</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {selected.capacity === 0
                        ? `${selected.booking_count}`
                        : `${selected.booking_count} / ${selected.capacity}`}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">slots filled</p>
                  </div>
                </div>
              </div>

              {/* Instructions & Description */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 space-y-2 shadow-xs">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <FileText className="size-5 text-blue-600" />
                  Instructions &amp; Description
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selected.description || "No activity description provided."}
                </p>
              </div>

              {/* Relevant Notes for Farmers (amber styling) */}
              <div className="rounded-2xl border border-amber-200/80 bg-[#fffbeb]/60 p-4 sm:p-5 space-y-2.5 shadow-xs">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <ClipboardList className="size-5 text-amber-600" />
                  Relevant Notes for Farmers
                </h3>
                {selected.farmer_notes ? (
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {selected.farmer_notes
                      .split("\n")
                      .map((l) => l.trim())
                      .filter((l) => l.length > 0)
                      .map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-slate-400 select-none">•</span>
                          <span>{line.replace(/^[-*•]\s*/, "")}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No additional notes for farmers.</p>
                )}
              </div>

              {/* Registered Farmers */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                    <Users className="size-5 text-emerald-600" />
                    Registered Farmers ({selectedBookings.length})
                  </h3>
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">
                    Capacity: {selected.capacity === 0 ? "No limit" : `${selected.capacity} slots`}
                  </span>
                </div>

                {!showBookingsRoster ? (
                  <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-6 sm:p-7 flex flex-col items-center justify-center text-center gap-3">
                    <Users className="size-10 text-slate-400 stroke-[1.5]" />
                    <p className="text-xs sm:text-sm font-medium text-slate-500">
                      {selectedBookings.length === 0
                        ? "No farmer bookings recorded yet for this session."
                        : `${selectedBookings.length} farmer booking${selectedBookings.length === 1 ? "" : "s"} recorded.`}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowBookingsRoster(true)}
                      className="h-10 px-4 rounded-xl border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 text-xs sm:text-sm shadow-xs"
                    >
                      <Users className="mr-2 size-4 text-slate-600" />
                      View Bookings ({selectedBookings.length})
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500">
                        {selectedBookings.length} registered participant{selectedBookings.length === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBookingsRoster(false)}
                        className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
                      >
                        Hide Bookings
                      </button>
                    </div>

                    {selectedBookings.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No bookings yet.</p>
                    ) : (
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                              <tr>
                                <th className="px-3.5 py-2.5">Farmer Name</th>
                                <th className="px-3.5 py-2.5">Barangay</th>
                                <th className="px-3.5 py-2.5">Time Slot</th>
                                <th className="px-3.5 py-2.5 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {selectedBookings.map((booking) => (
                                <tr
                                  key={booking.id}
                                  id={"program-booking-" + booking.id + "-desktop"}
                                  className={highlightedBookingId === booking.id ? "bg-emerald-100 ring-2 ring-inset ring-emerald-400" : "hover:bg-slate-50/60"}
                                >
                                  <td className="px-3.5 py-2.5 font-bold text-slate-900">{booking.farmer_name}</td>
                                  <td className="px-3.5 py-2.5 text-slate-600">{booking.farmer_barangay || "—"}</td>
                                  <td className="px-3.5 py-2.5 font-semibold text-slate-700">{formatTime(booking.time)}</td>
                                  <td className="px-3.5 py-2.5 text-center align-middle">
                                    <Badge variant="outline" className={`text-xs font-bold ${booking.status === "CONFIRMED" || booking.status === "ATTENDED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : booking.status === "NO_SHOW" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                                      {booking.status === "NO_SHOW" ? "No-show" : booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Stacked Cards View */}
                        <div className="sm:hidden space-y-2">
                          {selectedBookings.map((booking) => (
                            <div
                              key={booking.id}
                              id={"program-booking-" + booking.id + "-mobile"}
                              className={highlightedBookingId === booking.id
                                ? "rounded-lg border p-3 space-y-1.5 transition-colors border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300"
                                : "rounded-lg border p-3 space-y-1.5 transition-colors border-slate-200 bg-slate-50/60"}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs sm:text-sm font-bold text-slate-900">{booking.farmer_name}</p>
                                  <p className="text-xs text-slate-500">{booking.farmer_barangay || "Barangay not provided"}</p>
                                </div>
                                <Badge variant="outline" className={`text-xs font-bold ${booking.status === "CONFIRMED" || booking.status === "ATTENDED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : booking.status === "NO_SHOW" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                                  {booking.status === "NO_SHOW" ? "No-show" : booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                                <Clock3 className="size-3 text-slate-400" />
                                {formatTime(booking.time)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Notice / Controls */}
              {selected.can_manage ? (
                <section className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-900">
                      <Settings className="size-4.5 text-blue-700" />
                      Activity Controls
                    </h3>
                    <Badge variant="outline" className={selected.is_open ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-700"}>
                      {selected.is_open ? "Registration is Open" : "Registration is Closed"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || selected.date < todayIso()}
                      title={selected.date < todayIso() ? "Registration controls are unavailable for a past activity." : undefined}
                      onClick={() => setPendingAction({ schedule: selected, action: selected.is_open ? "close" : "reopen" })}
                      className="h-9 font-bold text-xs rounded-xl"
                    >
                      {selected.is_open ? <><LockKeyhole className="mr-1.5 size-3.5" /> Close Registration</> : <><UnlockKeyhole className="mr-1.5 size-3.5" /> Reopen Registration</>}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => startEdit(selected)}
                      className="h-9 font-bold text-blue-700 text-xs rounded-xl"
                    >
                      <Pencil className="mr-1.5 size-3.5" /> Edit Activity
                    </Button>
                    {selected.publication_status === "PUBLISHED" && selected.date <= todayIso() ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setPendingAction({ schedule: selected, action: "complete" })}
                        className="h-9 font-bold text-blue-700 text-xs rounded-xl"
                      >
                        <CalendarDays className="mr-1.5 size-3.5" /> End Activity
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setPendingAction({ schedule: selected, action: "delete" })}
                      className="h-9 border-rose-300 font-bold text-rose-700 hover:bg-rose-50 text-xs rounded-xl ml-auto"
                    >
                      <Trash2 className="mr-1.5 size-3.5" /> Delete
                    </Button>
                  </div>
                </section>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 sm:p-4 flex items-center gap-2.5 text-xs sm:text-sm text-slate-600">
                  <Info className="size-4.5 text-blue-600 shrink-0" />
                  <span>View-only program · Created by another CBAT officer.</span>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Conflict Alert Dialog */}
      <AlertDialog open={conflictPayload !== null} onOpenChange={(open) => { if (!open) setConflictPayload(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">Scheduling conflict detected</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {conflictPayload ? (() => {
                const location = schedules.find((schedule) => schedule.id !== editing?.id && schedule.date === conflictPayload.date && schedule.location.trim().toLocaleLowerCase() === conflictPayload.location.trim().toLocaleLowerCase());
                return location ? `“${location.program}” is already scheduled at ${location.location} on ${formatLongDate(location.date)}. Both programs offer overlapping appointment times.` : "Another program may overlap at this date and location.";
              })() : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-9 text-xs">Cancel</AlertDialogCancel>
            <Button type="button" disabled={busy || !conflictPayload} onClick={() => void continueAnyway()} className="h-9 text-xs">
              {busy ? "Saving…" : "Continue anyway"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(programErrorMessage)} onOpenChange={(open) => {
        if (!open) {
          setProgramErrorMessage("");
          setCanRetryProgramLoad(false);
        }
      }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">{canRetryProgramLoad ? "Could not load programs" : "Could not complete request"}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">{programErrorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {canRetryProgramLoad ? (
              <Button type="button" variant="outline" disabled={refreshing} onClick={() => {
                setProgramErrorMessage("");
                setCanRetryProgramLoad(false);
                void refresh();
              }} className="h-9 text-xs">
                {refreshing ? "Retrying…" : "Retry"}
              </Button>
            ) : null}
            <AlertDialogAction className="h-9 text-xs">Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={saveSuccessDialog !== null}
        onOpenChange={(open) => {
          if (!open && saveSuccessDialog) {
            setSaveSuccessDialog(null);
            void refresh();
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-2xl">
          <div className="flex flex-col items-center gap-3 py-2" role="status" aria-live="polite">
            <div className="relative mb-1 flex size-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-300 opacity-60 animate-ping-subtle motion-reduce:animate-none" />
              <span className="relative flex size-20 items-center justify-center rounded-full bg-linear-to-tr from-[#1b4332] to-emerald-600 text-white shadow-xl shadow-emerald-900/25 animate-pop-bounce motion-reduce:animate-none">
                <CheckCircle2 className="size-11 stroke-[2.5]" aria-hidden="true" />
              </span>
            </div>
            <DialogHeader className="items-center gap-2 text-center">
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                {saveSuccessDialog?.title}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-600">
                {saveSuccessDialog?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <Sparkles className="size-3.5 text-emerald-600" aria-hidden="true" />
              <span>Saved successfully</span>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button type="button" onClick={() => {
              setSaveSuccessDialog(null);
              void refresh();
            }} className="h-10 w-full rounded-xl bg-emerald-800 font-bold text-white hover:bg-emerald-900 sm:w-auto sm:min-w-32">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm changes that affect registrations or program history */}
      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              {pendingAction?.action === "delete" ? "Delete program?" : pendingAction?.action === "close" ? "Close program registrations?" : pendingAction?.action === "reopen" ? "Reopen program registrations?" : pendingAction?.action === "publish" ? "Publish program?" : pendingAction?.action === "unpublish" ? "Unpublish program?" : pendingAction?.action === "cancel" ? "Cancel program?" : "Mark program completed?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {pendingAction?.action === "delete"
                ? selectedHasBookingHistory && selectedIsPast ? "This completed schedule will be removed from Field Scheduling. Existing booking records will be preserved for history." : selectedHasBookingHistory ? "This program has bookings, so it cannot be deleted before its scheduled date. You can close it to prevent new bookings." : "This will permanently remove the program. It has no booking records."
                : pendingAction?.action === "close" ? "Farmers will no longer be able to book this program. All existing registrations will be preserved."
                  : pendingAction?.action === "reopen" ? "Farmers will be able to book open slots for this program again."
                    : pendingAction?.action === "publish" ? "Farmers in the selected coverage area can see and book this program immediately."
                      : pendingAction?.action === "unpublish" ? "The program will be hidden from farmers. Existing bookings will stay in its history."
                        : pendingAction?.action === "cancel" ? "Farmers with confirmed bookings will be notified. Booking history will be preserved."
                          : "The program will be marked complete, and registration will close."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || (pendingAction?.action === "delete" && selectedHasBookingHistory && !selectedIsPast)}
              onClick={(event) => { event.preventDefault(); void performAction(); }}
              className={`h-9 text-xs ${pendingAction?.action === "delete" ? "bg-rose-700 text-white hover:bg-rose-800" : ""}`}
            >
              {busy ? "Working…" : pendingAction?.action === "delete" ? selectedIsPast ? "Delete completed program" : "Delete program" : pendingAction?.action === "close" ? "Close registration" : pendingAction?.action === "reopen" ? "Reopen registration" : pendingAction?.action === "publish" ? "Publish now" : pendingAction?.action === "unpublish" ? "Unpublish" : pendingAction?.action === "cancel" ? "Cancel program" : "Mark completed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
