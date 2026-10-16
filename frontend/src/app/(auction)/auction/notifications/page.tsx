import { NotificationsView } from "@/app/components/notifications-view";

export const metadata = {
  title: "Notifications | Livestock Auction Market",
  description: "Auction gate check-ins, transfers, and inspection notices",
};

export default function AuctionNotificationsPage() {
  return (
    <main className="flex-1 min-w-0 pb-12">
      <NotificationsView
        variant="auction"
        title="Notifications"
        subtitle="Auction market gates, transfer records, and livestock inspection notices."
      />
    </main>
  );
}
