"use client";

import { PageHeader } from "@/app/components/page-header";
import {
AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,
AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardFooter,CardHeader,CardTitle } from "@/components/ui/card";
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Progress } from "@/components/ui/progress";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { apiError,getBarangays,getBookings,getSchedules,type BarangayOption,type ProgramBooking,type ProgramFarmerAudience,type ProgramPublicationStatus,type ProgramSchedule } from "@/lib/community-api";
import { CalendarDays,ClipboardList,Clock3,Image as ImageIcon,LockKeyhole,MapPin,Pencil,Plus,RefreshCw,Search,Trash2,UnlockKeyhole,Users } from "lucide-react";
import Image from "next/image";
import { useCallback,useEffect,useMemo,useState,type FormEvent } from "react";
import { ActivityPhotoCarousel } from "./activity-photo-carousel";
import { CommunityEmptyState,CommunityErrorCard,CommunitySkeleton,formatLongDate,formatTime,PROGRAM_TIME_SLOTS,todayIso,type CommunityRole } from "./community-ui";

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

function coverPreviewUrl(path: string): string {
  if (path.startsWith("blob:")) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${(api.defaults.baseURL || "").replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function FieldSchedulingManager({ role }: { role: ManagerRole }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramSchedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [timeToAdd, setTimeToAdd] = useState("");
  const [selected, setSelected] = useState<ProgramSchedule | null>(null);
  const [bookingCancelTarget, setBookingCancelTarget] = useState<ProgramBooking | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [conflictPayload, setConflictPayload] = useState<SchedulePayload | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [removeCover, setRemoveCover] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "upcoming" | "published" | "draft" | "completed" | "cancelled">("all");

  const load = useCallback(async () => {
    try {
      const [schedulesResult, bookingsResult, barangaysResult] = await Promise.allSettled([
        getSchedules(),
        getBookings(),
        getBarangays(),
      ]);

      if (schedulesResult.status === "fulfilled") {
        setSchedules(schedulesResult.value);
      }
      if (bookingsResult.status === "fulfilled") {
        setBookings(bookingsResult.value);
      }
      if (barangaysResult.status === "fulfilled") setBarangays(barangaysResult.value);

      if (schedulesResult.status === "rejected" && bookingsResult.status === "rejected") {
        setError(apiError(schedulesResult.reason));
      } else if (schedulesResult.status === "rejected") {
        setError(apiError(schedulesResult.reason));
      } else if (bookingsResult.status === "rejected") {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[FieldSchedulingManager] Bookings load warning:", bookingsResult.reason);
        }
        setError("");
      } else {
        setError("");
      }
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    // The asynchronous requests update state when they finish.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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
  const openCount = schedules.filter((schedule) => schedule.is_open).length;
  const uniqueFarmers = new Set(visibleConfirmedBookings.map((booking) => booking.farmer_name)).size;

  function startCreate() {
    setEditing(null);
    const canChooseBarangay = role === "admin" || user?.accessScope === "ALL_BARANGAYS";
    setForm({ ...emptyForm, available_times: [...PROGRAM_TIME_SLOTS], barangay: canChooseBarangay ? "" : String(user?.assignedBarangayId ?? ""), farmer_audience: role === "admin" || canChooseBarangay ? "ALL_FARMERS" : "BARANGAY_ONLY" });
    setCoverFile(null);
    setCoverPreview("");
    setRemoveCover(false);
    setTimeToAdd("");
    setFormOpen(true);
  }

  function startEdit(schedule: ProgramSchedule) {
    setEditing(schedule);
    setForm({ ...emptyForm, date: schedule.date, program: schedule.program, description: schedule.description || "", objectives: schedule.objectives || "", category: schedule.category || "OTHER", location: schedule.location, farmer_notes: schedule.farmer_notes || "", capacity: String(schedule.capacity), available_times: schedule.available_times || [...PROGRAM_TIME_SLOTS], registration_opens: schedule.registration_opens || "", registration_deadline: schedule.registration_deadline || "", eligibility: schedule.eligibility || "", contact_information: schedule.contact_information || "", barangay: schedule.barangay ? String(schedule.barangay) : "", farmer_audience: role === "admin" ? "ALL_FARMERS" : schedule.farmer_audience || (schedule.barangay ? "BARANGAY_ONLY" : "ALL_FARMERS"), publication_status: schedule.publication_status || "PUBLISHED" });
    setCoverFile(null);
    setCoverPreview(schedule.cover_image || "");
    setRemoveCover(false);
    setTimeToAdd("");
    setFormOpen(true);
  }

  async function persistSchedule(payload: SchedulePayload) {
    setBusy(true);
    setError("");
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
      if (editing) await api.patch(`/community/schedules/${editing.id}/`, body);
      else await api.post("/community/schedules/", body);
      setConflictPayload(null);
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setCoverFile(null);
      setCoverPreview("");
      setRemoveCover(false);
      setTimeToAdd("");
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const payload: SchedulePayload = { ...form, farmer_audience: role === "admin" ? "ALL_FARMERS" : form.farmer_audience, available_times: [...form.available_times].sort(), capacity: Number(form.capacity), program: form.program.trim(), description: form.description.trim(), objectives: form.objectives.trim(), location: form.location.trim(), farmer_notes: form.farmer_notes.trim(), eligibility: form.eligibility.trim(), contact_information: form.contact_information.trim(), registration_opens: form.registration_opens || null, registration_deadline: form.registration_deadline || null, barangay: form.barangay ? Number(form.barangay) : null };
    if (!Number.isInteger(payload.capacity) || payload.capacity < 1 || payload.capacity > 10000) {
      setError("Capacity must be a whole number from 1 to 10,000.");
      return;
    }
    if (editing && payload.capacity < editing.booking_count) {
      setError(`Capacity cannot be lower than the ${editing.booking_count} confirmed bookings.`);
      return;
    }
    if (payload.available_times.length === 0) {
      setError("Add at least one appointment time for farmers to choose.");
      return;
    }
    if (payload.farmer_audience === "BARANGAY_ONLY" && !payload.barangay) {
      setError("Choose a program barangay when access is limited to farmers in that barangay.");
      return;
    }
    if (payload.date === todayIso()) {
      const now = localTimeNow();
      const pastTimes = payload.available_times.filter(
        (time) => time <= now && !editing?.booked_times.includes(time),
      );
      if (pastTimes.length > 0) {
        setError("For today's schedule, remove past appointment times and choose a later time.");
        return;
      }
    }
    const normalizedLocation = payload.location.trim().toLocaleLowerCase();
    const conflict = schedules.find((schedule) =>
      schedule.id !== editing?.id &&
      schedule.date === payload.date &&
      normalizedLocation !== "" &&
      schedule.location.trim().toLocaleLowerCase() === normalizedLocation &&
      (schedule.available_times || PROGRAM_TIME_SLOTS).some((time) => payload.available_times.includes(time))
    );
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
    setError("");
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
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function recordAttendance(booking: ProgramBooking, status: "ATTENDED" | "NO_SHOW") {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/community/bookings/${booking.id}/`, { status });
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking() {
    if (!bookingCancelTarget) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/community/bookings/${bookingCancelTarget.id}/`, { status: "CANCELLED" });
      setBookingCancelTarget(null);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const selectedBookings = selected ? (bookingsBySchedule.get(selected.id) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)) : [];
  const selectedHasBookingHistory = pendingAction ? (bookingsBySchedule.get(pendingAction.schedule.id)?.length ?? 0) > 0 : false;
  const selectedIsPast = pendingAction ? pendingAction.schedule.date < todayIso() : false;
  const visibleSchedules = schedules.filter((schedule) => {
    const matchesSearch = `${schedule.program} ${schedule.location} ${schedule.barangay_name || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all"
      || (filter === "upcoming" && schedule.date >= todayIso() && schedule.publication_status === "PUBLISHED")
      || (filter === "published" && schedule.publication_status === "PUBLISHED")
      || (filter === "draft" && schedule.publication_status === "DRAFT")
      || (filter === "completed" && (schedule.publication_status === "COMPLETED" || schedule.registration_status === "COMPLETED"))
      || (filter === "cancelled" && schedule.publication_status === "CANCELLED");
    return matchesSearch && matchesFilter;
  });
  const accent = role === "sibat" ? "bg-[#1A365D] hover:bg-[#152c4b]" : "bg-[#2D5A27] hover:bg-[#24461f]";
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
              className={`h-10 gap-2 rounded-xl px-4 text-xs sm:text-sm font-bold text-white shadow-xs ${accent}`}
            >
              <Plus className="size-4" />
              <span>Create Program</span>
            </Button>
          </div>
        }
      />

      <main className="w-full space-y-4 p-3 sm:p-4 md:p-5">
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-red-800">
            {error}
          </p>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <KpiCard
            title="Program dates"
            value={schedules.length}
            icon={<CalendarDays className="size-4" />}
            description="All scheduled programs"
            variant="emerald"
            isLoading={loading}
          />
          <KpiCard
            title="Confirmed bookings"
            value={confirmedCount}
            icon={<Users className="size-4" />}
            description="Across listed programs"
            variant="sky"
            isLoading={loading}
          />
          <KpiCard
            title="Farmers involved"
            value={uniqueFarmers}
            icon={<Clock3 className="size-4" />}
            description={`${openCount} of ${schedules.length} open for booking`}
            variant="orange"
            isLoading={loading}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs" aria-label="Search programs" className="h-10 pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Filter programs">
            {(["all", "upcoming", "published", "draft", "completed", "cancelled"] as const).map((key) => (
              <Button key={key} type="button" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)} className="h-9 rounded-xl px-3 text-xs font-bold capitalize">
                {key}
              </Button>
            ))}
          </div>
        </div>

        {/* Schedule Grid */}
        {loading ? (
          <CommunitySkeleton cards={4} />
        ) : error && schedules.length === 0 ? (
          <CommunityErrorCard message={error} onRetry={() => void refresh()} />
        ) : schedules.length === 0 ? (
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <CardContent className="p-6">
              <CommunityEmptyState
                icon={<CalendarDays className="size-5" />}
                title="No scheduled programs yet"
                description="Create a program date to make appointment slots available for farmer registration."
                action={
                  <Button type="button" onClick={startCreate} className={`mt-2 h-10 px-4 text-xs sm:text-sm font-bold text-white rounded-xl ${accent}`}>
                    <Plus className="mr-1.5 size-4" /> Create Program
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          visibleSchedules.length === 0 ? (
            <Card className="rounded-xl border border-slate-200 bg-white shadow-xs"><CardContent className="p-6"><CommunityEmptyState icon={<Search className="size-5" />} title="No programs match" description="Try another search or filter." /></CardContent></Card>
          ) : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleSchedules.map((schedule) => {
              const roster = bookingsBySchedule.get(schedule.id) ?? [];
              const scheduleTimes = schedule.available_times?.length ? schedule.available_times : PROGRAM_TIME_SLOTS;
              const hasHistory = roster.length > 0;
              const isPastSchedule = schedule.date < todayIso();
              const status = schedule.registration_status;
              const statusConfig = {
                AVAILABLE: { label: "OPEN", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
                FULL: { label: "FULL", className: "border-amber-200 bg-amber-50 text-amber-900" },
                CLOSED: { label: "CLOSED", className: "border-slate-200 bg-slate-100 text-slate-700" },
                NOT_OPEN: { label: "REGISTRATION NOT OPEN", className: "border-sky-200 bg-sky-50 text-sky-700" },
                COMPLETED: { label: "COMPLETED", className: "border-slate-200 bg-slate-100 text-slate-600" },
                CANCELLED: { label: "CANCELLED", className: "border-rose-200 bg-rose-50 text-rose-700" },
              }[status] || { label: status, className: "border-slate-200 bg-slate-100 text-slate-700" };

              const bookedPercent = schedule.capacity
                ? Math.min(100, Math.round((schedule.booking_count / schedule.capacity) * 100))
                : 0;

              return (
                <Card
                  key={schedule.id}
                  className="flex min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="h-36 w-full bg-slate-100">
                    <ActivityPhotoCarousel
                      photos={[
                        ...(schedule.cover_image ? [coverPreviewUrl(schedule.cover_image)] : []),
                        ...schedule.photos.map((photo) => coverPreviewUrl(photo.image)),
                      ]}
                      alt={`${schedule.program} activity`}
                    />
                  </div>
                  <CardHeader className="gap-2 p-4 sm:p-4.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="truncate text-base sm:text-lg font-black tracking-tight text-slate-900">
                          {schedule.program}
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs sm:text-sm text-slate-500 font-medium">
                          <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
                            <CalendarDays className="size-3.5 text-emerald-700" />
                            {formatLongDate(schedule.date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="size-3.5 text-slate-400" />
                            {scheduleTimes.length > 1
                              ? `${formatTime(scheduleTimes[0])} – ${formatTime(scheduleTimes[scheduleTimes.length - 1])}`
                              : formatTime(scheduleTimes[0])}
                          </span>
                          {schedule.location ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-600">
                              <MapPin className="size-3.5 text-rose-500" />
                              <span className="truncate max-w-[200px]">{schedule.location}</span>
                            </span>
                          ) : null}
                        </CardDescription>
                      </div>

                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs font-bold uppercase tracking-wider ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 px-4 pb-4 sm:px-4.5">
                    {schedule.description ? <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">{schedule.description}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-[11px]">{schedule.category.replaceAll("_", " ")}</Badge>
                      {schedule.barangay_name ? <Badge variant="outline" className="text-[11px]">{schedule.barangay_name}</Badge> : <Badge variant="outline" className="text-[11px]">Municipality-wide</Badge>}
                      <Badge variant="outline" className="text-[11px]">
                        {schedule.farmer_audience === "ALL_FARMERS" ? "All Barangays" : `Farmers in ${schedule.barangay_name || "program barangay"}`}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">{schedule.publication_status}</Badge>
                    </div>
                    {schedule.farmer_notes ? (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                        <ClipboardList className="mt-0.5 size-4 shrink-0 text-amber-700" />
                        <div><p className="font-bold">Farmer reminder</p><p className="mt-0.5 whitespace-pre-wrap">{schedule.farmer_notes}</p></div>
                      </div>
                    ) : null}
                    {/* Capacity Display & Progress Bar */}
                    <div className="space-y-1.5 rounded-lg bg-slate-50/80 p-2.5 border border-slate-100">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-medium text-slate-700">
                          <strong className="font-semibold text-slate-900">{schedule.booking_count}</strong> / {schedule.capacity} booked
                        </span>
                        <span className="font-medium">
                          {schedule.remaining_slots > 0 ? (
                            <span className="text-emerald-700 font-semibold">{schedule.remaining_slots} slots remaining</span>
                          ) : (
                            <span className="text-amber-700 font-semibold">0 slots remaining</span>
                          )}
                        </span>
                      </div>
                      <Progress
                        value={bookedPercent}
                        aria-label={`${schedule.booking_count} of ${schedule.capacity} slots booked`}
                        className="h-2 rounded-full bg-slate-200/80 [&>div]:bg-emerald-600 [&>div]:rounded-full"
                      />
                    </div>

                    {/* Time slots breakdown */}
                    <div className="flex flex-wrap gap-1.5">
                      {scheduleTimes.map((slot) => {
                        const slotBookings = schedule.booked_times.filter((t) => t === slot).length;
                        return (
                          <span
                            key={slot}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                              slotBookings > 0
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-slate-200/80 bg-slate-50 text-slate-600"
                            }`}
                          >
                            <Clock3 className="size-3 text-slate-400" />
                            {formatTime(slot)}
                            {slotBookings > 0 ? (
                              <span className="font-semibold text-amber-800">({slotBookings})</span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  </CardContent>

                  {/* Actions Bar */}
                  <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 sm:px-4.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(schedule)}
                      className="h-9 gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Users className="size-3.5 text-slate-500" />
                      View bookings ({roster.length})
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(schedule)}
                        className="h-9 gap-1 rounded-xl px-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="size-3" /> Edit
                      </Button>
                      {schedule.publication_status === "DRAFT" ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPendingAction({ schedule, action: "publish" })} className="h-9 rounded-xl px-2.5 text-xs font-bold text-emerald-700">Publish</Button>
                      ) : schedule.publication_status === "PUBLISHED" ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPendingAction({ schedule, action: "unpublish" })} className="h-9 rounded-xl px-2.5 text-xs font-bold text-slate-700">Unpublish</Button>
                      ) : null}
                      {schedule.publication_status === "PUBLISHED" ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPendingAction({ schedule, action: "cancel" })} className="h-9 rounded-xl px-2.5 text-xs font-bold text-rose-700">Cancel</Button>
                      ) : null}
                      {schedule.publication_status === "PUBLISHED" && schedule.date <= todayIso() ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPendingAction({ schedule, action: "complete" })} className="h-9 rounded-xl px-2.5 text-xs font-bold text-sky-700">Complete</Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingAction({ schedule, action: schedule.is_open ? "close" : "reopen" })}
                        className="h-9 gap-1 rounded-xl px-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                      >
                    {schedule.is_open ? (
                          <>
                            <LockKeyhole className="size-3 text-slate-500" /> Close
                          </>
                        ) : (
                          <>
                            <UnlockKeyhole className="size-3 text-slate-500" /> Reopen
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title={hasHistory && !isPastSchedule ? "Schedules with bookings can be deleted after their date." : isPastSchedule ? "Remove completed schedule; booking history will be preserved." : "Delete program"}
                        disabled={hasHistory && !isPastSchedule}
                        onClick={() => setPendingAction({ schedule, action: "delete" })}
                        className="h-8 gap-1 rounded-lg px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                      >
                        <Trash2 className="size-3" /> Delete
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </main>

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
                <Input id="program-cover" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 8 * 1024 * 1024) { setError("Choose an image that is 8 MB or smaller."); event.target.value = ""; return; } setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); setRemoveCover(false); setError(""); }} className="h-10 text-xs" />
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
                      const nextTimes = nextDate === todayIso()
                        ? form.available_times.filter(
                            (time) => time > localTimeNow() || Boolean(editing?.booked_times.includes(time)),
                          )
                        : form.available_times;
                      setForm({ ...form, date: nextDate, available_times: nextTimes });
                    }}
                    className="h-10 text-sm font-medium"
                  />
                  {editing && editing.date < todayIso() ? (
                    <span className="block text-xs font-medium text-slate-400">Past dates cannot be altered.</span>
                  ) : null}
                </label>

                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-capacity">
                  Maximum Slots
                  <Input
                    id="schedule-capacity"
                    type="number"
                    required
                    min={1}
                    max={10000}
                    step={1}
                    value={form.capacity}
                    onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                    className="h-10 text-sm font-medium"
                  />
                </label>
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
                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-available-time">
                  Appointment Times
                  <span className="block text-[11px] font-normal text-slate-500">Choose the times farmers can book for this program.</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    id="schedule-available-time"
                    type="time"
                    min={form.date === todayIso() ? localTimeNow() : undefined}
                    value={timeToAdd}
                    onChange={(event) => setTimeToAdd(event.target.value)}
                    className="h-10 min-w-0 text-sm font-medium"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !timeToAdd ||
                      form.available_times.includes(timeToAdd) ||
                      (form.date === todayIso() && timeToAdd <= localTimeNow())
                    }
                    onClick={() => {
                      setForm({ ...form, available_times: [...form.available_times, timeToAdd].sort() });
                      setTimeToAdd("");
                    }}
                    className="h-10 shrink-0 gap-1.5"
                  >
                    <Plus className="size-4" /> Add time
                  </Button>
                </div>
                {form.date === todayIso() ? (
                  <p className="text-[11px] font-medium text-amber-800">For today, only times later than {formatTime(localTimeNow())} can be added.</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {form.available_times.map((time) => {
                    const hasBooking = Boolean(editing?.booked_times.includes(time));
                    return (
                      <Badge key={time} variant="outline" className="gap-1.5 border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                        <Clock3 className="size-3 text-slate-500" />
                        {formatTime(time)}
                        <button
                          type="button"
                          aria-label={`Remove ${formatTime(time)}`}
                          title={hasBooking ? "Confirmed bookings use this time" : "Remove time"}
                          disabled={hasBooking}
                          onClick={() => setForm({ ...form, available_times: form.available_times.filter((value) => value !== time) })}
                          className="ml-1 rounded-full text-slate-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-location">
                Venue
                <Input
                  id="schedule-location"
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

      {/* View Bookings Dialog */}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl rounded-2xl border border-slate-200">
          {selected ? (
            <>
              <div className="-mx-6 -mt-6 h-48 overflow-hidden rounded-t-2xl bg-slate-100 sm:h-64">
                <ActivityPhotoCarousel
                  photos={[
                    ...(selected.cover_image ? [coverPreviewUrl(selected.cover_image)] : []),
                    ...selected.photos.map((photo) => coverPreviewUrl(photo.image)),
                  ]}
                  alt={`${selected.program} activity`}
                  variant="dialog"
                />
              </div>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DialogTitle className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{selected.program}</DialogTitle>
                  <Badge variant="outline" className="text-xs sm:text-sm font-bold">
                    {selectedBookings.length} {selectedBookings.length === 1 ? "farmer" : "farmers"} registered
                  </Badge>
                </div>
                <DialogDescription className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs sm:text-sm text-slate-500 font-medium pt-0.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                    <CalendarDays className="size-3.5 text-emerald-700" />
                    {formatLongDate(selected.date)}
                  </span>
                  {selected.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-rose-500" />
                      {selected.location}
                    </span>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Registered Farmers</h3>
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">
                    Capacity: {selected.booking_count} / {selected.capacity}
                  </span>
                </div>

                {selectedBookings.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs sm:text-sm text-slate-500 font-medium">
                    No farmer bookings recorded for this program yet.
                  </p>
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
                            <th className="px-3.5 py-2.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {selectedBookings.map((booking) => (
                            <tr key={booking.id} className="hover:bg-slate-50/60">
                              <td className="px-3.5 py-2.5 font-bold text-slate-900">{booking.farmer_name}</td>
                              <td className="px-3.5 py-2.5 text-slate-600">{booking.farmer_barangay || "—"}</td>
                              <td className="px-3.5 py-2.5 font-semibold text-slate-700">{formatTime(booking.time)}</td>
                              <td className="px-3.5 py-2.5 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <Badge variant="outline" className={`text-xs font-bold ${booking.status === "CONFIRMED" || booking.status === "ATTENDED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : booking.status === "NO_SHOW" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                                    {booking.status === "NO_SHOW" ? "No-show" : booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                                  </Badge>
                                  {booking.status === "CONFIRMED" && (selected.date < todayIso() || (selected.date === todayIso() && booking.time.slice(0, 5) <= localTimeNow())) ? <>
                                    <Button type="button" variant="outline" disabled={busy} onClick={() => void recordAttendance(booking, "ATTENDED")} className="h-8 px-2 text-[11px]">Present</Button>
                                    <Button type="button" variant="outline" disabled={busy} onClick={() => void recordAttendance(booking, "NO_SHOW")} className="h-8 px-2 text-[11px]">No-show</Button>
                                  </> : null}
                                  {booking.status === "CONFIRMED" && (selected.date > todayIso() || (selected.date === todayIso() && booking.time.slice(0, 5) > localTimeNow())) ? <Button type="button" variant="outline" disabled={busy} onClick={() => setBookingCancelTarget(booking)} className="h-8 px-2 text-[11px] text-rose-700 hover:text-rose-800">Cancel booking</Button> : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Stacked Cards View */}
                    <div className="sm:hidden space-y-2">
                      {selectedBookings.map((booking) => (
                        <div key={booking.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
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
                          {booking.status === "CONFIRMED" && (selected.date < todayIso() || (selected.date === todayIso() && booking.time.slice(0, 5) <= localTimeNow())) ? <div className="flex gap-2 pt-1"><Button type="button" variant="outline" disabled={busy} onClick={() => void recordAttendance(booking, "ATTENDED")} className="h-8 text-xs">Mark attended</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void recordAttendance(booking, "NO_SHOW")} className="h-8 text-xs">Mark no-show</Button></div> : null}
                          {booking.status === "CONFIRMED" && (selected.date > todayIso() || (selected.date === todayIso() && booking.time.slice(0, 5) > localTimeNow())) ? <Button type="button" variant="outline" disabled={busy} onClick={() => setBookingCancelTarget(booking)} className="mt-1 h-8 text-xs text-rose-700 hover:text-rose-800">Cancel booking</Button> : null}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => startEdit(selected)} className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold">
                  <Pencil className="mr-1.5 size-3.5" /> Edit program
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingAction({ schedule: selected, action: selected.is_open ? "close" : "reopen" })}
                  className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold"
                >
                  {selected.is_open ? (
                    <><LockKeyhole className="mr-1.5 size-3.5 text-slate-500" /> Close program</>
                  ) : (
                    <><UnlockKeyhole className="mr-1.5 size-3.5 text-slate-500" /> Reopen program</>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={bookingCancelTarget !== null} onOpenChange={(open) => { if (!open && !busy) setBookingCancelTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">Cancel this farmer booking?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {bookingCancelTarget ? `${bookingCancelTarget.farmer_name}'s place will be released and the farmer will be notified. The booking will remain in program history.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-9 text-xs">Keep booking</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !bookingCancelTarget} onClick={(event) => { event.preventDefault(); void cancelBooking(); }} className="h-9 bg-rose-700 text-xs text-white hover:bg-rose-800">
              {busy ? "Cancelling…" : "Cancel booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogAction disabled={busy || !conflictPayload} onClick={(event) => { event.preventDefault(); if (conflictPayload) void persistSchedule(conflictPayload); }} className="h-9 text-xs">
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
