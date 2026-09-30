"use client";
import { Badge } from "@/components/ui/badge";

import { CalendarDays, Clock, MapPin, Pin, User, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity } from "@/lib/community-api";
import { AUDIENCE_LABEL, activityCategory, CommunityRole, formatLongDate, formatTimeWindow } from "./community-ui";
import { ActivityScheduleCard } from "./activity-schedule-card";
import { ActivityPhotoCarousel } from "./activity-photo-carousel";

export function ActivityDetailDialog({
  activity,
  role,
  open,
  onOpenChange,
}: {
  activity: Activity | null;
  role: CommunityRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!activity) return null;
  const category = activityCategory(activity.category);
  const CategoryIcon = category.icon;
  const publishedDate = activity.published_at || activity.created_at;
  const photos = [...(activity.image ? [activity.image] : []), ...activity.photos.map((photo) => photo.image)];
  const paragraphs = activity.content.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl gap-0 overflow-hidden rounded-3xl p-0 sm:w-[calc(100%-2rem)] [&>button]:right-3 [&>button]:top-3 [&>button]:z-30 [&>button]:size-9 [&>button]:rounded-full [&>button]:bg-white/85 [&>button]:text-slate-700 [&>button]:opacity-100 [&>button]:shadow-md [&>button]:ring-0 [&>button]:backdrop-blur-sm hover:[&>button]:bg-white">
        <article className="flex max-h-[92dvh] flex-col overflow-y-auto overscroll-contain">
          <div className="group relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-slate-100 sm:aspect-video">
            <ActivityPhotoCarousel photos={photos} alt={activity.title} variant="dialog" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
            {activity.is_pinned ? (
              <span className="absolute left-4 top-4 z-20 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-sm backdrop-blur-sm">
                <Pin className="size-3" /> Pinned
              </span>
            ) : null}
          </div>

          <div className="relative -mt-8 flex-1 rounded-t-3xl bg-white px-5 pb-8 pt-6 shadow-[0_-10px_30px_-18px_rgba(15,23,42,0.35)] sm:px-8 sm:pb-10 sm:pt-8">
            <div className="mx-auto max-w-2xl space-y-6">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`inline-flex gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${category.badge}`}>
                    <CategoryIcon className={`size-3.5 ${category.iconClass}`} /> {activity.category}
                  </Badge>
                </div>
                <DialogTitle className="text-balance break-words text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">{activity.title}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{formatLongDate(activity.schedule?.date || publishedDate)}</span>
                  {activity.schedule ? <span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><Clock className="size-4 text-emerald-600" />{formatTimeWindow()}</span> : null}
                  <span className="inline-flex items-center gap-1.5"><User className="size-4" />{activity.author}</span>
                  {activity.schedule?.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-rose-500" />{activity.schedule.location}</span> : null}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 border-t border-slate-200 pt-6 text-[15px] leading-7 text-slate-700">
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
                <Users className="size-4 text-slate-400" />
                Shared with {AUDIENCE_LABEL[activity.audience]}
              </div>

              {activity.schedule ? <ActivityScheduleCard schedule={activity.schedule} role={role} /> : null}
            </div>
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
}
