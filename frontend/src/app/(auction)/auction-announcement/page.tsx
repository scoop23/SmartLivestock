"use client";

import { ActivitiesFeed } from "@/app/components/community/activities-feed";

export default function AuctionAnnouncementPage() {
  // Reuse the community feed. The role controls its wording and presentation;
  // audience visibility is filtered by the announcements API.
  return <ActivitiesFeed role="auction" />;
}
