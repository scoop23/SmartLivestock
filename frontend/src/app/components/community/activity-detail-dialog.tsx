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
      <DialogContent className="max-h-[90vh] w-[calc(100%-1rem)] max-w-3xl gap-0 overflow-hidden rounded-2xl border border-slate-200 p-0 shadow-xl sm:w-full [&>button]:right-3.5 [&>button]:top-3.5 [&>button]:z-30 [&>button]:size-8 [&>button]:rounded-full [&>button]:border [&>button]:border-white/60 [&>button]:bg-white/85 [&>button]:text-slate-700 [&>button]:shadow-sm [&>button]:backdrop-blur-sm hover:[&>button]:bg-white">
        <article className="flex max-h-[90vh] flex-col overflow-y-auto overscroll-contain">
          {/* Feature Image / Photo Carousel */}
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-slate-100">
            <ActivityPhotoCarousel photos={photos} alt={activity.title} variant="dialog" />
            {activity.is_pinned ? (
              <span className="absolute left-3.5 top-3.5 z-20 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-semibold text-amber-950 shadow-sm">
                <Pin className="size-3" /> Pinned
              </span>
            ) : null}
          </div>

          {/* Article Header & Body */}
          <div className="flex-1 p-5 sm:p-7 md:p-8">
            <div className="mx-auto max-w-2xl space-y-5">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`inline-flex gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${category.badge}`}>
                    <CategoryIcon className={`size-3.5 ${category.iconClass}`} /> {activity.category}
                  </Badge>
                </div>

                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl leading-snug sm:leading-tight">
                  {activity.title}
                </DialogTitle>

                <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 sm:text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-slate-400" />
                    {formatLongDate(activity.schedule?.date || publishedDate)}
                  </span>
                  {activity.schedule ? (
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <Clock className="size-3.5 text-emerald-700" />
                      {formatTimeWindow()}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-3.5 text-slate-400" />
                    {activity.author}
                  </span>
                  {activity.schedule?.location ? (
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <MapPin className="size-3.5 text-rose-500" />
                      {activity.schedule.location}
                    </span>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              {/* Divider */}
              <hr className="border-slate-200/80" />

              {/* Full Description / Article Content */}
              <div className="space-y-4 text-sm leading-relaxed text-slate-700 sm:text-[15px] sm:leading-7">
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap break-words">{paragraph}</p>
                ))}
              </div>

              {/* Program Details Section (if linked) */}
              {activity.schedule ? (
                <>
                  <hr className="border-slate-200/80" />
                  <ActivityScheduleCard schedule={activity.schedule} role={role} />
                </>
              ) : null}

              {/* Footer / Audience Info */}
              <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
                <Users className="size-3.5" />
                <span>Audience: {AUDIENCE_LABEL[activity.audience]}</span>
              </div>
            </div>
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
}
