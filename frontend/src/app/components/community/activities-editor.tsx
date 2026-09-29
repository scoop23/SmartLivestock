"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  RotateCw,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/app/components/page-header";
import api from "@/lib/axios";
import { Activity, apiError, getActivities } from "@/lib/community-api";
import {
  AUDIENCE_LABEL,
  CommunityEmptyState,
  CommunityErrorCard,
  Panel,
  ROLE_ACCENT,
  StatusPill,
  categoryTone,
  formatShortDate,
  type CommunityRole,
} from "./community-ui";

type Form = {
  title: string;
  content: string;
  category: string;
  audience: Activity["audience"];
  is_pinned: boolean;
};

const blank: Form = {
  title: "",
  content: "",
  category: "General",
  audience: "ALL",
  is_pinned: false,
};

const CATEGORIES = [
  "General",
  "Health Alert",
  "Event",
  "Program",
  "Market Update",
  "Field Memo",
];

type Filter = "all" | "published" | "draft";

export function ActivitiesEditor({ role }: { role: CommunityRole }) {
  const accent = ROLE_ACCENT[role];
  const [items, setItems] = useState<Activity[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await getActivities());
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
    void load();
  }, [load]);

  function close() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
  }

  function startCreate() {
    close();
    setOpen(true);
    setError("");
  }

  function startEdit(item: Activity) {
    setEditing(item);
    setForm({
      title: item.title,
      content: item.content,
      category: item.category,
      audience: item.audience,
      is_pinned: item.is_pinned,
    });
    setOpen(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(published: boolean) {
    if (!form.title.trim() || !form.content.trim() || !form.category.trim()) {
      setError("Title, category and details are required.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category.trim(),
        is_published: published,
      };
      if (editing) {
        await api.patch("/community/announcements/" + editing.id + "/", payload);
      } else {
        await api.post("/community/announcements/", payload);
      }
      await refresh();
      close();
      setNotice(published ? "Activity published." : "Draft saved.");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Activity) {
    if (!window.confirm('Delete "' + item.title + '"?')) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete("/community/announcements/" + item.id + "/");
      await refresh();
      setNotice("Activity deleted.");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const term = search.toLowerCase().trim();
  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (filter === "published" && !item.is_published) return false;
        if (filter === "draft" && item.is_published) return false;
        if (!term) return true;
        return [item.title, item.content, item.category, item.author].some(
          (value) => value.toLowerCase().includes(term)
        );
      }),
    [items, filter, term]
  );

  const published = items.filter((item) => item.is_published).length;
  const pinned = items.filter((item) => item.is_pinned).length;

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Publish announcements and field memos for farmers and SIBAT"
        icon={<Megaphone className="size-5 text-slate-800" />}
        variant={role}
        maxWidthClass="w-full"
        action={
          <Button
            onClick={startCreate}
            className={`h-9 shrink-0 gap-1.5 rounded-xl px-3 text-xs font-bold text-white cursor-pointer ${
              role === "sibat"
                ? "bg-[#1A365D] hover:bg-[#152c4b]"
                : "bg-[#2D5A27] hover:bg-[#24461f]"
            }`}
          >
            <Plus className="size-4" /> New activity
          </Button>
        }
      />

      <main className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">
        {error && open === false ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-bold text-red-800"
          >
            {error}
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-bold text-emerald-800"
          >
            <CheckCircle2 className="size-4" /> {notice}
          </div>
        ) : null}

        {/* Compose / edit form */}
        {open ? (
          <Panel
            className="border-l-4 border-l-[#2D5A27]"
            title={editing ? "Edit activity" : "Create an activity"}
            icon={
              <span
                className={`flex size-7 items-center justify-center rounded-lg ${accent.tint} ${accent.text}`}
              >
                <Megaphone className="size-3.5" />
              </span>
            }
            description="Set the audience, then save as a draft or publish immediately."
            action={
              <button
                type="button"
                aria-label="Close editor"
                onClick={close}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            }
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save(editing?.is_published ?? false);
              }}
              className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"
            >
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="activity-title"
                    className="text-[11px] font-black uppercase tracking-wider text-slate-500"
                  >
                    Title
                  </label>
                  <Input
                    id="activity-title"
                    required
                    maxLength={200}
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="e.g. Barangay vaccination drive"
                    className="mt-1.5 h-9 text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="activity-content"
                    className="text-[11px] font-black uppercase tracking-wider text-slate-500"
                  >
                    Details
                  </label>
                  <Textarea
                    id="activity-content"
                    required
                    rows={6}
                    value={form.content}
                    onChange={(event) =>
                      setForm({ ...form, content: event.target.value })
                    }
                    placeholder="Share the date, place and what participants need to know…"
                    className="mt-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="activity-category"
                    className="text-[11px] font-black uppercase tracking-wider text-slate-500"
                  >
                    Category
                  </label>
                  <Input
                    id="activity-category"
                    required
                    maxLength={40}
                    list="activity-categories"
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                    className="mt-1.5 h-9 text-xs"
                  />
                  <datalist id="activity-categories">
                    {CATEGORIES.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="activity-audience"
                    className="text-[11px] font-black uppercase tracking-wider text-slate-500"
                  >
                    Visible to
                  </label>
                  <select
                    id="activity-audience"
                    value={form.audience}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        audience: event.target.value as Activity["audience"],
                      })
                    }
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-400"
                  >
                    <option value="ALL">Farmers and SIBAT</option>
                    <option value="FARMER">Farmers only</option>
                    <option value="SIBAT">SIBAT only</option>
                  </select>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(event) =>
                      setForm({ ...form, is_pinned: event.target.checked })
                    }
                    className="size-3.5 accent-emerald-700"
                  />
                  <Pin className={`size-3.5 ${accent.icon}`} /> Pin at the top
                </label>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="lg:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-800"
                >
                  {error}
                </p>
              ) : null}

              <div className="lg:col-span-2 flex flex-wrap justify-end gap-2 pt-3.5 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  className="h-9 rounded-xl px-3 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={busy}
                  className="h-9 rounded-xl px-3 text-xs font-bold cursor-pointer"
                >
                  {editing?.is_published ? "Save changes" : "Save draft"}
                </Button>
                {!editing?.is_published ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={(event) => {
                      if (event.currentTarget.form?.reportValidity()) void save(true);
                    }}
                    className="h-9 gap-1.5 rounded-xl px-3 text-xs font-bold text-white cursor-pointer bg-[#2D5A27] hover:bg-[#24461f]"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Publish
                  </Button>
                ) : null}
              </div>
            </form>
          </Panel>
        ) : null}

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <KpiCard
            title="All activities"
            value={items.length}
            icon={<Megaphone className="w-4 h-4" />}
            description="Total records"
            variant="emerald"
            size="sm"
          />
          <KpiCard
            title="Published"
            value={published}
            icon={<CheckCircle2 className="w-4 h-4" />}
            description="Visible to users"
            variant="sky"
            size="sm"
          />
          <KpiCard
            title="Drafts"
            value={items.length - published}
            icon={<Clock3 className="w-4 h-4" />}
            description="Not yet announced"
            variant="amber"
            size="sm"
          />
          <KpiCard
            title="Pinned"
            value={pinned}
            icon={<Pin className="w-4 h-4" />}
            description="Featured at top"
            variant="orange"
            size="sm"
          />
        </div>

        {/* Activity library */}
        <Panel
          title="Community activities"
          icon={<Megaphone className={`w-3.5 h-3.5 ${accent.icon}`} />}
          description="Published updates and drafts from MAO and SIBAT."
          action={
            <div className="flex items-center gap-2">
              {isFetching ? (
                <RotateCw className="size-3.5 animate-spin text-slate-400" />
              ) : null}
              <label className="relative hidden sm:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                  aria-label="Search activities"
                  className="h-8 w-52 pl-8 text-xs"
                />
              </label>
            </div>
          }
        >
          <div className="flex items-center gap-1 border-b border-slate-100 mb-3">
            {(
              [
                ["all", "All"],
                ["published", "Published"],
                ["draft", "Drafts"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`border-b-2 px-3 pb-2 text-[11px] font-black transition-colors cursor-pointer ${
                  filter === value
                    ? `border-current ${accent.text}`
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <CommunityLoadingRows />
          ) : error && items.length === 0 ? (
            <CommunityErrorCard message={error} onRetry={refresh} />
          ) : visible.length === 0 ? (
            <CommunityEmptyState
              icon={<Megaphone className="size-5" />}
              title="No activities found"
              description="Create one, or change the tab and search filters."
            />
          ) : (
            <div className="grid gap-2.5 grid-cols-1 lg:grid-cols-2">
              {visible.map((item) => {
                const tone = categoryTone(item.category);
                return (
                  <article
                    key={item.id}
                    className="flex flex-col rounded-xl border border-slate-200 p-3.5 transition-all hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill
                        className={
                          item.is_published
                            ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                            : "text-amber-800 bg-amber-50 border-amber-200"
                        }
                      >
                        {item.is_published ? "Published" : "Draft"}
                      </StatusPill>
                      <StatusPill className={tone.badge}>{item.category}</StatusPill>
                      {item.is_pinned ? (
                        <Pin className={`size-3.5 ${accent.icon}`} />
                      ) : null}
                    </div>

                    <h4 className="mt-2.5 text-sm font-black text-slate-900 leading-snug">
                      {item.title}
                    </h4>
                    <p className="mt-1.5 line-clamp-3 flex-1 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
                      {item.content}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {AUDIENCE_LABEL[item.audience]}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {formatShortDate(item.published_at || item.created_at)}
                      </span>
                      <span className="truncate">By {item.author}</span>
                    </div>

                    <div className="mt-2.5 flex gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => startEdit(item)}
                        className="h-7 gap-1 rounded-lg px-2 text-[11px] font-bold cursor-pointer"
                      >
                        <Pencil className="size-3" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busy}
                        onClick={() => remove(item)}
                        className="h-7 gap-1 rounded-lg px-2 text-[11px] font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="size-3" /> Delete
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      </main>
    </>
  );
}

function CommunityLoadingRows() {
  return (
    <div className="grid gap-2.5 grid-cols-1 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 p-3.5">
          <div className="flex gap-1.5">
            <div className="h-4 w-16 rounded-full bg-slate-100" />
            <div className="h-4 w-20 rounded-full bg-slate-100" />
          </div>
          <div className="mt-2.5 h-4 w-3/4 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-full rounded bg-slate-100" />
          <div className="mt-1.5 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
