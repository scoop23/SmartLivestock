export interface Announcement {
  id: number;
  title: string;
  date: string;
  category: "Policy" | "Schedule" | "System" | "Market";
  author: string;
  content: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: "New Inspection Protocol Effective May 1, 2026",
    date: "2026-04-20",
    category: "Policy",
    author: "Municipal Agriculture Office (MAO)",
    content:
      "All livestock inspections must now include a veterinary health certificate and valid handler license. Please ensure all required clearance documents are verified before issuing transport clearances.",
  },
  {
    id: 2,
    title: "Auction Market Schedule Update — Weekly Wednesday & Saturday",
    date: "2026-04-18",
    category: "Schedule",
    author: "Padre Garcia Livestock Auction Terminal",
    content:
      "The weekly livestock auction will be held every Wednesday and Saturday. All auction staff and veterinary inspectors are required to be on-site by 5:30 AM for antemortem inspections.",
  },
  {
    id: 3,
    title: "System Maintenance Notice — Scheduled Server Optimization",
    date: "2026-04-15",
    category: "System",
    author: "IT Operations Unit",
    content:
      "The SmartLivestock cloud system will undergo routine database maintenance on April 30, 2026 from 10:00 PM to 2:00 AM. Clearance syncing may be temporarily queued during this period.",
  },
  {
    id: 4,
    title: "Regional Biosecurity & Checkpoint Alert",
    date: "2026-04-10",
    category: "Market",
    author: "Bureau of Animal Industry (BAI)",
    content:
      "Strict quarantine checkpoints remain active along the Batangas-Quezon boundary. Ensure all inter-provincial animal shipments carry valid shipping permits and vaccination records.",
  },
];
