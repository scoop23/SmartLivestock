"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, Image as ImageIcon, MapPin, Megaphone, MoreHorizontal, Pencil, Pin, Plus, RotateCw, Search, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/app/components/page-header";
import api from "@/lib/axios";
import { Activity, apiError, getActivities, getSchedules, ProgramSchedule } from "@/lib/community-api";
import { ACTIVITY_CATEGORIES, AUDIENCE_LABEL, activityCategory, CommunityEmptyState, CommunityErrorCard, CommunityRole, CommunitySkeleton, formatShortDate, formatTimeWindow } from "./community-ui";
import { ActivityDetailDialog } from "./activity-detail-dialog";
import { ActivityPhotoCarousel } from "./activity-photo-carousel";

const blank = {
  title: "",
  content: "",
  category: "General",
  audience: "ALL" as Activity["audience"],
  is_pinned: false,
  schedule_id: "",
};
type Filter = "all" | "published" | "draft" | "pinned" | "linked" | "unlinked";

export function ActivitiesEditor({ role }: { role: CommunityRole }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);
  const [photoFiles, setPhotoFiles] = useState<{ file: File; preview: string }[]>([]);
  const previewUrls = useRef(new Set<string>());
  const [removePhotoIds, setRemovePhotoIds] = useState<number[]>([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [activityRows, scheduleRows] = await Promise.all([getActivities(), getSchedules()]);
      setItems(activityRows);
      setSchedules(scheduleRows);
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
    // The async request updates loading state when it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function revokePreview(url: string) {
    URL.revokeObjectURL(url);
    previewUrls.current.delete(url);
  }

  function clearPhotoPreviews() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setPhotoFiles([]);
  }

  function close() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
    setRemoveImage(false);
    setRemovePhotoIds([]);
    clearPhotoPreviews();
    setError("");
  }

  function startCreate() {
    close();
    setOpen(true);
  }

  function startEdit(item: Activity) {
    clearPhotoPreviews();
    setRemovePhotoIds([]);
    setEditing(item);
    setForm({
      title: item.title,
      content: item.content,
      category: item.category,
      audience: item.audience,
      is_pinned: item.is_pinned,
      schedule_id: item.schedule ? String(item.schedule.id) : "",
    });
    setRemoveImage(false);
    setOpen(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePhotoChange(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (selected.some((file) => !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) {
      setError("Choose image files that are 8 MB or smaller.");
      return;
    }
    if (selected.length + photoFiles.length > 10) {
      setError("Add up to 10 photos at a time.");
      return;
    }
    const added = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { file, preview };
    });
    setPhotoFiles((current) => [...current, ...added]);
    setRemoveImage(false);
    setError("");
  }

  function removeNewPhoto(index: number) {
    setPhotoFiles((current) => {
      const target = current[index];
      if (target) revokePreview(target.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function save(published: boolean) {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Add a title and details before saving.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      ...form,
      title: form.title.trim(),
      content: form.content.trim(),
      is_published: published,
      remove_image: removeImage,
    };
    try {
      let body: FormData | typeof payload = payload;
      if (photoFiles.length || removePhotoIds.length || removeImage) {
        const multipart = new FormData();
        Object.entries(payload).forEach(([key, value]) => multipart.append(key, String(value)));
        photoFiles.forEach(({ file }) => multipart.append("photo_uploads", file));
        removePhotoIds.forEach((id) => multipart.append("remove_photo_ids", String(id)));
        body = multipart;
      }
      if (editing) {
        await api.patch(`/community/announcements/${editing.id}/`, body);
      } else {
        await api.post("/community/announcements/", body);
      }
      await refresh();
      close();
      setNotice(published ? "Announcement published." : "Draft saved.");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Activity) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/community/announcements/${item.id}/`);
      await refresh();
      setNotice("Activity deleted.");
      setDeleteTarget(null);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const term = search.toLowerCase().trim();
  const visible = useMemo(() => items.filter((item) => {
    if (filter === "published" && !item.is_published) return false;
    if (filter === "draft" && item.is_published) return false;
    if (filter === "pinned" && !item.is_pinned) return false;
    if (filter === "linked" && !item.schedule) return false;
    if (filter === "unlinked" && item.schedule) return false;
    if (categoryFilter !== "All categories" && item.category !== categoryFilter) return false;
    return !term || [item.title, item.content, item.category, item.author, item.schedule?.program ?? "", item.schedule?.location ?? ""].some((value) => value.toLowerCase().includes(term));
  }).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
  }), [items, filter, categoryFilter, term]);

  const scheduleOptions = schedules;

  return (
    <>
      <PageHeader
        title="Activities & Announcements"
        subtitle="Share municipal programs, events, and important updates with farmers and SIBAT."
        icon={<Megaphone className="size-5 text-slate-800" />}
        variant={role}
        maxWidthClass="w-full"
        action={<Button onClick={startCreate} className={`h-10 shrink-0 gap-2 rounded-xl px-3 text-xs font-bold text-white ${role === "sibat" ? "bg-[#1A365D] hover:bg-[#152c4b]" : "bg-[#2D5A27] hover:bg-[#24461f]"}`}><Plus className="size-4" /> New announcement</Button>}
      />

      <main className="w-full space-y-4 p-3 sm:p-4 md:p-6">
        {error && !open ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-bold text-red-800">{error}</div> : null}
        {notice ? <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-bold text-emerald-800"><CheckCircle2 className="size-4" />{notice}</div> : null}

        {open ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div><h2 className="text-base font-semibold text-slate-900">{editing ? "Edit activity" : "Create an activity"}</h2><p className="mt-1 text-sm text-slate-500">Share clear information with the people who need it.</p></div>
              <button type="button" aria-label="Close announcement editor" onClick={close} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
            </div>
            <form onSubmit={(event: FormEvent) => { event.preventDefault(); void save(editing?.is_published ?? false); }} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-xs font-semibold text-slate-900">Activity details</p>
                  <label htmlFor="activity-title" className="text-xs font-bold text-slate-700">Title</label>
                  <Input id="activity-title" required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Cattle vaccination drive" className="mt-1.5 h-10 text-sm" />
                </div>
                <div>
                  <label htmlFor="activity-category" className="text-xs font-bold text-slate-700">Category</label>
                  <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
                    <SelectTrigger id="activity-category" className="mt-1.5 h-10 w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                    <SelectContent>{ACTIVITY_CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="activity-content" className="text-xs font-bold text-slate-700">Details</label>
                  <Textarea id="activity-content" required rows={6} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Explain what is happening and what participants need to know…" className="mt-1.5 text-sm" />
                </div>
                <div>
                  <label htmlFor="activity-photos" className="text-xs font-bold text-slate-700">Add Photos <span className="font-normal text-slate-400">(optional, up to 10 per upload)</span></label>
                  <input id="activity-photos" type="file" accept="image/*" multiple onChange={(event) => { handlePhotoChange(event.target.files); event.target.value = ""; }} className="sr-only" />
                  <Button asChild type="button" variant="outline" className="mt-1.5 w-full"><label htmlFor="activity-photos"><Plus className="size-4" /> Add Photos</label></Button>
                  <p className="mt-1 text-[11px] text-slate-500">Each image must be 8 MB or smaller.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {editing?.image && !removeImage ? <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200"><img src={editing.image} alt="Existing activity photo" className="size-full object-cover" /><Button type="button" variant="destructive" size="icon" aria-label="Remove existing photo" onClick={() => setRemoveImage(true)} className="absolute right-1.5 top-1.5 size-7 rounded-full"><X /></Button></div> : null}
                    {(editing?.photos ?? []).filter((photo) => !removePhotoIds.includes(photo.id)).map((photo) => <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200"><img src={photo.image} alt="Existing activity photo" className="size-full object-cover" /><Button type="button" variant="destructive" size="icon" aria-label="Remove existing photo" onClick={() => setRemovePhotoIds((ids) => [...ids, photo.id])} className="absolute right-1.5 top-1.5 size-7 rounded-full"><X /></Button></div>)}
                    {photoFiles.map((photo, index) => <div key={photo.preview} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200"><img src={photo.preview} alt={`New activity photo ${index + 1}`} className="size-full object-cover" /><Button type="button" variant="destructive" size="icon" aria-label={`Remove selected photo ${index + 1}`} onClick={() => removeNewPhoto(index)} className="absolute right-1.5 top-1.5 size-7 rounded-full"><X /></Button></div>)}
                    {!editing?.image && (editing?.photos ?? []).length === 0 && photoFiles.length === 0 ? <div className="col-span-full flex aspect-video items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-300"><ImageIcon className="size-8" aria-hidden="true" /></div> : null}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="mb-3 text-xs font-semibold text-slate-900">Audience and visibility</p>
                  <label htmlFor="activity-audience" className="text-xs font-bold text-slate-700">Who can see this announcement?</label>
                  <Select value={form.audience} onValueChange={(audience) => setForm({ ...form, audience: audience as Activity["audience"] })}>
                    <SelectTrigger id="activity-audience" className="mt-1.5 h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ALL">Farmers and SIBAT</SelectItem><SelectItem value="FARMER">Farmers only</SelectItem><SelectItem value="SIBAT">SIBAT only</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold text-slate-900">Related field program</p>
                  <label htmlFor="activity-schedule" className="text-xs font-bold text-slate-700">Link a program <span className="font-normal text-slate-400">(optional)</span></label>
                  <Select value={form.schedule_id || "none"} onValueChange={(scheduleId) => setForm({ ...form, schedule_id: scheduleId === "none" ? "" : scheduleId })}>
                    <SelectTrigger id="activity-schedule" className="mt-1.5 h-10 w-full"><SelectValue placeholder="No field program" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No field program</SelectItem>
                      {scheduleOptions.map((schedule) => <SelectItem key={schedule.id} value={String(schedule.id)}>{schedule.program} · {formatShortDate(schedule.date)} · {schedule.booking_count}/{schedule.capacity} filled</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">Date, location, and available slots come from Field Scheduling.</p>
                  <label className="mt-4 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={form.is_pinned} onChange={(event) => setForm({ ...form, is_pinned: event.target.checked })} className="size-4 accent-emerald-700" />
                    <Pin className="size-3.5" /> Pin near the top
                  </label>
                </div>
                {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-800">{error}</p> : null}
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button type="button" variant="ghost" onClick={close} className="h-10 rounded-xl text-xs">Cancel</Button>
                  <Button type="submit" variant="outline" disabled={busy} className="h-10 rounded-xl text-xs">{busy ? "Saving…" : editing?.is_published ? "Save changes" : "Save draft"}</Button>
                  {!editing?.is_published ? <Button type="button" disabled={busy} onClick={(event) => { if (event.currentTarget.form?.reportValidity()) void save(true); }} className="h-10 gap-2 rounded-xl bg-emerald-700 text-xs text-white hover:bg-emerald-800">{busy ? <RotateCw className="size-4 animate-spin" /> : <Send className="size-4" />} Publish</Button> : null}
                </div>
              </div>
            </form>
          </section>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-semibold text-slate-900">Manage activities</h2><p className="text-xs text-slate-500">Search and filter published posts and drafts.</p></div>
            <label className="relative block w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, details, or author" aria-label="Search announcements" className="h-9 pl-9 text-xs" /></label>
          </div>
          <div className="flex flex-col gap-2 border-y border-slate-100 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {([ ["all", "All"], ["published", "Published"], ["draft", "Drafts"], ["pinned", "Pinned"], ["linked", "With field program"], ["unlinked", "No field program"] ] as const).map(([value, label]) => <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-3 text-[11px] ${filter === value ? "bg-emerald-800 text-white hover:bg-emerald-900" : "bg-slate-50 text-slate-600"}`}>{label}</Button>)}
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Filter by category" className="h-9 w-full sm:w-auto"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="All categories">All categories</SelectItem>{ACTIVITY_CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isFetching ? <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><RotateCw className="size-3 animate-spin" /> Updating</p> : null}
          {loading ? <CommunitySkeleton cards={3} /> : error && items.length === 0 ? <CommunityErrorCard message={error} onRetry={() => void refresh()} /> : visible.length === 0 ? <CommunityEmptyState icon={<Megaphone className="size-5" />} title="No announcements found" description="Try another category or clear the filters." /> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => {
                const category = activityCategory(item.category);
                const Icon = category.icon;
                const photos = [...(item.image ? [item.image] : []), ...item.photos.map((photo) => photo.image)];
                return (
                  <Card key={item.id} onClick={() => setSelected(item)} className="group flex min-w-0 cursor-pointer flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-emerald-500/40">
                    <div className="group relative aspect-video w-full overflow-hidden bg-slate-100">
                      <ActivityPhotoCarousel photos={photos} alt={item.title} />
                      {item.is_pinned ? <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-sm backdrop-blur-sm"><Pin className="size-3" />Pinned</span> : null}
                    </div>
                    <CardContent className="flex flex-1 flex-col p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`gap-1 text-[9px] font-bold uppercase ${category.badge}`}><Icon className={`size-3 ${category.iconClass}`} />{item.category}</Badge>
                        <Badge variant={item.is_published ? "secondary" : "outline"}>{item.is_published ? "Published" : "Draft"}</Badge>
                      </div>
                      <h3 className="mt-2.5 text-sm font-black leading-snug text-slate-900 transition-colors group-hover:text-emerald-800">
                        <button type="button" className="text-left">{item.title}</button>
                      </h3>
                      <p className="mt-1.5 line-clamp-5 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{item.content}</p>
                      <div className="mt-2 text-[10px] text-slate-500">{AUDIENCE_LABEL[item.audience]} · {formatShortDate(item.published_at || item.created_at)}</div>
                      {item.schedule ? (
                        <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
                          <p className="truncate font-semibold text-slate-700">Field program: {item.schedule.program}</p>
                          <p className="flex items-center gap-1.5"><CalendarDays className="size-3.5 shrink-0 text-emerald-600" />{formatShortDate(item.schedule.date)} · {formatTimeWindow()}</p>
                          {item.schedule.location ? <p className="flex items-start gap-1.5"><MapPin className="mt-px size-3.5 shrink-0 text-rose-500" /><span className="line-clamp-2">{item.schedule.location}</span></p> : null}
                        </div>
                      ) : null}
                      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" aria-label={`Actions for ${item.title}`} onClick={(event) => event.stopPropagation()} className="relative z-10 size-9 rounded-lg"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onSelect={() => startEdit(item)}><Pencil className="size-4" />Edit activity</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => setDeleteTarget(item)}><Trash2 className="size-4" />Delete activity</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <AlertDialog open={deleteTarget !== null} onOpenChange={(isOpen) => { if (!isOpen && !busy) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>“{deleteTarget?.title}” will be removed. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); if (deleteTarget) void remove(deleteTarget); }} className="bg-rose-700 text-white hover:bg-rose-800">{busy ? "Deleting…" : "Delete activity"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ActivityDetailDialog activity={selected} role={role} open={selected !== null} onOpenChange={(value) => { if (!value) setSelected(null); }} />
    </>
  );
}