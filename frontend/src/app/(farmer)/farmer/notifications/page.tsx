import { NotificationsView } from "@/app/components/notifications-view";

export const metadata = {
  title: "Notifications | Farmer Portal",
  description: "View livestock alerts, submissions, and advisories",
};

export default function FarmerNotificationsPage() {
  return (
    <main className="flex-1 min-w-0 pb-12">
      <NotificationsView
        variant="farmer"
        title="Notifications"
        subtitle="Your livestock alerts, submission reviews, and agricultural advisories."
      />
    </main>
  );
}
