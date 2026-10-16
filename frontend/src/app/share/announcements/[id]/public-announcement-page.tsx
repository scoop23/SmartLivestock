"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Megaphone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, getActivities } from "@/lib/community-api";
import { ActivityPhotoCarousel } from "@/app/components/community/activity-photo-carousel";
import { activityCategory, formatShortDate } from "@/app/components/community/community-ui";
import type { PublicAnnouncementShare } from "./share-data";

type ArticleData = {
  title: string;
  content: string;
  category: string;
  images: string[];
  publishedAt: string | null;
};

export default function PublicAnnouncementPage({
  id,
  publicAnnouncement,
}: {
  id: string;
  publicAnnouncement: PublicAnnouncementShare | null;
}) {
  const { user, isLoading: authLoading } = useAuth();
  const [authorizedLookup, setAuthorizedLookup] = useState<{
    username: string;
    activity: Activity | null;
    finished: boolean;
  } | null>(null);
  const currentUsername = user?.username ?? "";
  const lookupMatchesUser = authorizedLookup?.username === currentUsername;
  const authorizedActivity = lookupMatchesUser ? authorizedLookup?.activity ?? null : null;
  const lookupFinished = lookupMatchesUser && Boolean(authorizedLookup?.finished);

  useEffect(() => {
    if (publicAnnouncement || authLoading || !user) return;

    let active = true;
    void getActivities()
      .then((activities) => {
        if (!active) return;
        setAuthorizedLookup({
          username: currentUsername,
          activity: activities.find((item) => String(item.id) === id && item.is_published) ?? null,
          finished: false,
        });
      })
      .catch(() => {
        if (active) setAuthorizedLookup({ username: currentUsername, activity: null, finished: false });
      })
      .finally(() => {
        if (active) {
          setAuthorizedLookup((current) => current?.username === currentUsername ? { ...current, finished: true } : current);
        }
      });
    return () => {
      active = false;
    };
  }, [authLoading, currentUsername, id, publicAnnouncement, user]);

  const article = useMemo<ArticleData | null>(() => {
    if (publicAnnouncement) {
      return {
        title: publicAnnouncement.title,
        content: publicAnnouncement.content,
        category: publicAnnouncement.category,
        images: [publicAnnouncement.image, ...publicAnnouncement.photos.map((photo) => photo.image)].filter((image): image is string => Boolean(image)),
        publishedAt: publicAnnouncement.published_at,
      };
    }
    if (!authorizedActivity) return null;
    return {
      title: authorizedActivity.title,
      content: authorizedActivity.content,
      category: authorizedActivity.category,
      images: [authorizedActivity.image, ...authorizedActivity.photos.map((photo) => photo.image)].filter((image): image is string => Boolean(image)),
      publishedAt: authorizedActivity.published_at,
    };
  }, [authorizedActivity, publicAnnouncement]);

  if (!article) {
    const waiting = authLoading || (Boolean(user) && !lookupFinished);
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-9">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{waiting ? "Loading announcement…" : "Announcement not available"}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            {waiting
              ? "Checking whether this announcement is available to your account."
              : user
                ? "This announcement may be unpublished or outside your account’s authorized audience."
                : "This announcement is limited to an authorized SmartLivestock audience. Sign in to check access."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {!waiting && !user ? <Button asChild className="rounded-xl"><Link href="/login">Sign in</Link></Button> : null}
            <Button asChild variant="outline" className="rounded-xl"><Link href="/">Go to SmartLivestock</Link></Button>
          </div>
        </section>
      </main>
    );
  }

  const category = activityCategory(article.category);
  const CategoryIcon = category.icon;
  const paragraphs = article.content.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-9">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
          <ArrowLeft className="size-4" /> SmartLivestock-Batangas
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><ShieldCheck className="size-4" /> Official announcement</span>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
        <div className="group relative aspect-[16/9] max-h-[420px] w-full overflow-hidden bg-slate-100 sm:aspect-[21/9]">
          <ActivityPhotoCarousel photos={article.images} alt={article.title} variant="dialog" />
        </div>
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase ${category.badge}`}>
              <CategoryIcon className={`size-3.5 ${category.iconClass}`} /> {article.category}
            </Badge>
            {article.publishedAt ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <CalendarDays className="size-3.5" /> Published {formatShortDate(article.publishedAt)}
              </span>
            ) : null}
          </div>
          <h1 className="break-words text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">{article.title}</h1>
          <div className="space-y-4 border-t border-slate-200 pt-5 text-sm leading-relaxed text-slate-700 sm:text-base">
            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`} className={`whitespace-pre-wrap break-words ${index === 0 ? "font-medium text-slate-900" : ""}`}>
                {paragraph}
              </p>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <Megaphone className="size-4 text-emerald-700" /> Shared from SmartLivestock-Batangas
          </div>
        </div>
      </article>
    </main>
  );
}
