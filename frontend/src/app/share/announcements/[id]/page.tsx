import type { Metadata } from "next";
import PublicAnnouncementPage from "./public-announcement-page";
import { getPublicAnnouncementShare } from "./share-data";

type RouteProps = { params: Promise<{ id: string }> };

function previewDescription(content: string): string {
  const plainText = content.replace(/\s+/g, " ").trim();
  return plainText.length > 220 ? `${plainText.slice(0, 217)}…` : plainText;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { id } = await params;
  const announcement = await getPublicAnnouncementShare(id);
  if (!announcement) {
    return {
      title: "SmartLivestock-Batangas Announcement",
      description: "View official livestock announcements from SmartLivestock-Batangas.",
      robots: { index: false, follow: false },
    };
  }

  const description = previewDescription(announcement.content) || "Official SmartLivestock-Batangas announcement.";
  const shareUrl = announcement.share_url || undefined;
  let defaultImage: string | undefined;
  if (shareUrl) {
    try {
      defaultImage = new URL(`/share/announcements/${announcement.id}/opengraph-image`, shareUrl).toString();
    } catch {
      defaultImage = undefined;
    }
  }
  const images = announcement.image ? [announcement.image] : defaultImage ? [defaultImage] : [];

  return {
    title: `${announcement.title} | SmartLivestock-Batangas`,
    description,
    alternates: shareUrl ? { canonical: shareUrl } : undefined,
    openGraph: {
      type: "article",
      title: announcement.title,
      description,
      url: shareUrl,
      siteName: "SmartLivestock-Batangas",
      publishedTime: announcement.published_at || undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: announcement.title,
      description,
      images,
    },
  };
}

export default async function AnnouncementShareRoute({ params }: RouteProps) {
  const { id } = await params;
  const announcement = await getPublicAnnouncementShare(id);
  return <PublicAnnouncementPage id={id} publicAnnouncement={announcement} />;
}
