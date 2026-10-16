"use client";

import { useState } from "react";
import {
  Building2,
  CalendarDays,
  Pin,
  Share2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity } from "@/lib/community-api";
import {
  AUDIENCE_LABEL,
  activityCategory,
  CommunityRole,
  formatLongDate,
} from "./community-ui";
import { ActivityPhotoCarousel } from "./activity-photo-carousel";
import { AnnouncementShareDialog } from "./announcement-share-dialog";

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
  const [shareOpen, setShareOpen] = useState(false);

  if (!activity) return null;

  const category = activityCategory(activity.category);
  const CategoryIcon = category.icon;
  const publishedDate = activity.published_at || activity.created_at;
  const photos = [
    ...(activity.image ? [activity.image] : []),
    ...activity.photos.map((photo) => photo.image),
  ];
  const paragraphs = activity.content
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[calc(100%-1.25rem)] max-w-5xl gap-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-0 shadow-2xl sm:w-[94vw] sm:max-h-[92vh] sm:rounded-3xl lg:w-full lg:max-w-5xl xl:max-w-6xl [&>button]:right-3 [&>button]:top-3 sm:[&>button]:right-4 sm:[&>button]:top-4 [&>button]:z-30 [&>button]:size-8.5 sm:[&>button]:size-9 [&>button]:p-0 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-white/80 [&>button]:bg-white/90 [&>button]:text-slate-700 [&>button]:shadow-sm [&>button]:backdrop-blur-md [&>button]:opacity-100 hover:[&>button]:bg-white hover:[&>button]:opacity-100 touch-manipulation [&>button>svg]:size-4 sm:[&>button>svg]:size-4.5 [&>button>svg]:shrink-0 [&>button>svg]:m-0">
        <article className="flex max-h-[94vh] sm:max-h-[92vh] flex-col overflow-y-auto overscroll-contain">
          {/* Feature Image / Photo Carousel */}
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-slate-100 sm:aspect-[21/9] lg:aspect-[24/9] max-h-[220px] sm:max-h-[320px] md:max-h-[380px] lg:max-h-[440px]">
            <ActivityPhotoCarousel photos={photos} alt={activity.title} variant="dialog" />

            {/* Pinned Tag Overlay */}
            {activity.is_pinned ? (
              <span className="absolute left-3 top-3 sm:left-4 sm:top-4 z-20 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950 shadow-sm backdrop-blur-sm">
                <Pin className="size-3" /> Pinned Advisory
              </span>
            ) : null}

            {/* Subtle Gradient Vignette */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent"
            />
          </div>

          {/* Article Reader Body */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl lg:max-w-5xl space-y-6 sm:space-y-7">
              {/* Header Meta */}
              <DialogHeader className="space-y-3.5 sm:space-y-4 text-left">
                {/* Category & Authority Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge
                      variant="outline"
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs sm:text-sm font-bold uppercase tracking-wider ${category.badge}`}
                    >
                      <CategoryIcon className={`size-3.5 sm:size-4 ${category.iconClass}`} />
                      <span>{activity.category}</span>
                    </Badge>

                    <span className="inline-flex max-w-[240px] sm:max-w-none items-center gap-1.5 truncate rounded-full bg-slate-100 px-3 py-1 text-xs sm:text-sm font-medium text-slate-700">
                      <Building2 className="size-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{activity.author || "Municipal Agriculture Office"}</span>
                    </span>
                  </div>

                  {/* Share Action */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!activity.is_published}
                    onClick={() => setShareOpen(true)}
                    className="h-9 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
                    title={activity.is_published ? "Share announcement" : "Publish before sharing"}
                  >
                    <Share2 className="size-3.5" />
                    <span>Share</span>
                  </Button>
                </div>

                {/* Article Title */}
                <DialogTitle className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-snug break-words">
                  {activity.title}
                </DialogTitle>

                {/* Detailed Date & Venue Metadata */}
                <DialogDescription className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1.5 text-xs sm:text-sm font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-4 text-emerald-700 shrink-0" />
                    <span>{formatLongDate(publishedDate)}</span>
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* Subtle Horizontal Divider */}
              <hr className="border-slate-200/80" />

              {/* Prose Content */}
              <div className="space-y-4 leading-relaxed text-slate-700 text-sm sm:text-base">
                {paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className={`whitespace-pre-wrap break-words ${
                      index === 0
                        ? "text-base sm:text-lg font-medium text-slate-900 leading-relaxed"
                        : "text-slate-700 leading-relaxed"
                    }`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Reader Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100 pt-5 text-sm text-slate-500">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Users className="size-4 text-slate-400 shrink-0" />
                  <span>
                    Audience:{" "}
                    <strong className="font-semibold text-slate-700">
                      {activity.audience === "SIBAT_BARANGAY" && activity.target_barangay_name
                        ? `SIBAT — ${activity.target_barangay_name} Only`
                        : AUDIENCE_LABEL[activity.audience] || activity.audience}
                    </strong>
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-10 w-full sm:w-auto rounded-xl px-5 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Close Reader
                </Button>
              </div>
            </div>
          </div>
        </article>
      </DialogContent>
      <AnnouncementShareDialog activity={activity} open={shareOpen} onOpenChange={setShareOpen} />
    </Dialog>
  );
}
