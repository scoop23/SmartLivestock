import { ImageResponse } from "next/og";
import { getPublicAnnouncementShare } from "./share-data";

export const runtime = "edge";
export const alt = "SmartLivestock-Batangas announcement preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function AnnouncementOpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const announcement = await getPublicAnnouncementShare(id);
  const title = announcement?.title || "Livestock Information & Services";
  const category = announcement?.category || "PADRE GARCIA · BATANGAS";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "66px 76px",
          color: "#f8fafc",
          background: "linear-gradient(135deg, #123c2c 0%, #1f6848 58%, #94a952 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, fontWeight: 700, letterSpacing: 1 }}>
          <div style={{ display: "flex", width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, background: "rgba(255,255,255,0.18)", fontSize: 30 }}>S</div>
          SMARTLIVESTOCK-BATANGAS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 3, color: "#d9f99d" }}>{category.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: title.length > 70 ? 48 : 62, lineHeight: 1.12, fontWeight: 800, overflow: "hidden" }}>{title}</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#e2e8f0" }}>Official livestock programs, services, and announcements</div>
      </div>
    ),
    size,
  );
}
