"use client";

import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import type { Activity } from "@/lib/community-api";
import {
Camera,
Check,
Copy,
ExternalLink,
MessageCircle,
Phone,
Share2,
Smartphone,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(field);
  if (!copied) throw new Error("Clipboard copy was blocked.");
}

function shareLinkFor(activity: Activity): string | null {
  const candidate = activity.share_url?.trim();
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || (parsed.protocol === "http:" && process.env.NODE_ENV !== "production")) {
        return parsed.toString();
      }
    } catch {
      // Use the current production origin below if the API value is malformed.
    }
  }

  if (typeof window === "undefined") return null;
  const { hostname, origin } = window.location;
  if (process.env.NODE_ENV === "production" && ["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return null;
  }
  return new URL(`/share/announcements/${activity.id}`, origin).toString();
}

function PlatformMark({ children, className }: { children: ReactNode; className: string }) {
  return <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-lg ${className}`}>{children}</span>;
}

export function AnnouncementShareDialog({
  activity,
  open,
  onOpenChange,
}: {
  activity: Activity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = shareLinkFor(activity);
  const preview = activity.content.replace(/\s+/g, " ").trim();
  const shortPreview = preview.length > 190 ? `${preview.slice(0, 187)}…` : preview;
  const shareText = `${activity.title}\n${shareUrl ?? ""}`.trim();

  const copyLink = async (label = "Announcement link copied.") => {
    if (!shareUrl) {
      toast.error("Sharing link is not configured for this site.");
      return;
    }
    try {
      await copyText(shareUrl);
      setCopied(true);
      toast.success(label);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this announcement link:", shareUrl);
      toast.info("Copy the selected link and paste it into your app.");
    }
  };

  const shareNatively = async () => {
    if (!shareUrl || !navigator.share) {
      toast.info("Device sharing is unavailable. Choose another option or copy the link.");
      return;
    }
    const payload = { title: activity.title, text: shortPreview, url: shareUrl };
    if (navigator.canShare && !navigator.canShare(payload)) {
      toast.info("This browser cannot share that content. Choose another option or copy the link.");
      return;
    }
    try {
      await navigator.share(payload);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("The device share sheet could not be opened. You can still copy the link.");
    }
  };

  const openExternal = (url: string) => {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) toast.error("Your browser blocked the share window. Copy the link instead.");
  };

  const shareFacebook = () => {
    if (!shareUrl) return void toast.error("Sharing link is not configured for this site.");
    const target = new URL("https://www.facebook.com/sharer/sharer.php");
    target.searchParams.set("u", shareUrl);
    openExternal(target.toString());
  };

  const shareWhatsApp = () => {
    if (!shareUrl) return void toast.error("Sharing link is not configured for this site.");
    const target = new URL("https://wa.me/");
    target.searchParams.set("text", shareText);
    openExternal(target.toString());
  };

  const shareViber = () => {
    if (!shareUrl) return void toast.error("Sharing link is not configured for this site.");
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
      void copyLink("Link copied for sharing in Viber.");
      return;
    }
    const maxViberTextLength = 200;
    const titleLength = Math.max(0, maxViberTextLength - shareUrl.length - 1);
    const viberText = `${activity.title.slice(0, titleLength)} ${shareUrl}`.trim();
    if (viberText.length > maxViberTextLength) {
      void copyLink("The announcement link is too long for Viber. It was copied instead.");
      return;
    }
    window.location.href = `viber://forward?text=${encodeURIComponent(viberText)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Share2 className="size-5 text-emerald-700" /> Share announcement
          </DialogTitle>
          <DialogDescription>
            Share the announcement link. The destination app will let you review before sending.
          </DialogDescription>
        </DialogHeader>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3.5" aria-label="Announcement preview">
          <p className="line-clamp-2 text-sm font-bold text-slate-900">{activity.title}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{shortPreview || "Official SmartLivestock-Batangas announcement."}</p>
        </section>

        {!activity.is_published ? (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Publish this announcement before sharing it.
          </p>
        ) : activity.audience !== "ALL" ? (
          <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            This announcement is limited to its selected audience. Recipients must sign in with an authorized account. Public previews are disabled for restricted announcements.
          </p>
        ) : null}

        {shareUrl ? (
          <div className="flex min-w-0 gap-2">
            <input
              aria-label="Announcement share link"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            />
            <Button type="button" variant="outline" disabled={!activity.is_published} onClick={() => void copyLink()} className="h-10 shrink-0 gap-2 rounded-lg px-3">
              {copied ? <Check className="size-4 text-emerald-700" /> : <Copy className="size-4" />}
              <span className="hidden sm:inline">Copy link</span>
              <span className="sm:hidden">Copy</span>
            </Button>
          </div>
        ) : (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            A production frontend URL is not configured. Set Django&apos;s <code>FRONTEND_URL</code> to the canonical site address.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Sharing options">
          <Button type="button" variant="outline" disabled={!activity.is_published || !shareUrl} onClick={() => void shareNatively()} className="h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-xl px-3 py-2 text-left">
            <PlatformMark className="bg-emerald-100 text-emerald-800"><Smartphone className="size-4" /></PlatformMark>
            <span className="text-xs font-semibold">Share with apps</span>
          </Button>
          <Button type="button" variant="outline" disabled={!activity.is_published || !shareUrl} onClick={shareFacebook} className="h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-xl px-3 py-2 text-left">
            <PlatformMark className="bg-blue-100 text-blue-800"><span className="text-lg font-black leading-none">f</span></PlatformMark>
            <span className="text-xs font-semibold">Facebook</span>
          </Button>
          <Button type="button" variant="outline" disabled={!activity.is_published || !shareUrl} onClick={() => void copyLink("Link copied for Messenger. Paste it into a Messenger chat.")} className="h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-xl px-3 py-2 text-left">
            <PlatformMark className="bg-sky-100 text-sky-800"><MessageCircle className="size-4" /></PlatformMark>
            <span className="text-xs font-semibold">Messenger · copy link</span>
          </Button>
          <Button type="button" variant="outline" disabled={!activity.is_published || !shareUrl} onClick={shareWhatsApp} className="h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-xl px-3 py-2 text-left">
            <PlatformMark className="bg-green-100 text-green-800"><MessageCircle className="size-4" /></PlatformMark>
            <span className="text-xs font-semibold">WhatsApp</span>
          </Button>
          <Button type="button" variant="outline" disabled={!activity.is_published || !shareUrl} onClick={() => void copyLink("Link copied for Instagram. Paste it into a post, Story, or message.")} className="h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-xl px-3 py-2 text-left">
            <PlatformMark className="bg-fuchsia-100 text-fuchsia-800"><Camera className="size-4" /></PlatformMark>
            <span className="text-xs font-semibold">Instagram · copy link</span>
          </Button>
          <Button type="button" variant="outline" disabled={!activity.is_published || !shareUrl} onClick={shareViber} className="h-auto min-h-12 justify-start gap-2.5 whitespace-normal rounded-xl px-3 py-2 text-left">
            <PlatformMark className="bg-violet-100 text-violet-800"><Phone className="size-4" /></PlatformMark>
            <span className="text-xs font-semibold">Viber</span>
          </Button>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Facebook shares the link only. Messenger and Instagram do not offer a dependable general website-share URL, so those options copy the link. On mobile, Viber opens its app when available; otherwise use Copy Link.
          {" "}<a href={shareUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline underline-offset-2">
            Preview link <ExternalLink className="size-3" />
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
