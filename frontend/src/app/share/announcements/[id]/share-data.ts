
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

export type PublicAnnouncementShare = {
  id: number;
  title: string;
  content: string;
  category: string;
  image: string | null;
  photos: Array<{ id: number; image: string; position: number }>;
  published_at: string | null;
  share_url: string | null;
};

export async function getPublicAnnouncementShare(id: string): Promise<PublicAnnouncementShare | null> {
  if (!/^\d+$/.test(id)) return null;

  try {
    const apiBase = API_BASE_URL.replace(/\/$/, "");
    const response = await fetch(`${apiBase}/community/announcements/${id}/share/`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const announcement: PublicAnnouncementShare = await response.json();
    return announcement.id === Number(id) ? announcement : null;
  } catch {
    return null;
  }
}
