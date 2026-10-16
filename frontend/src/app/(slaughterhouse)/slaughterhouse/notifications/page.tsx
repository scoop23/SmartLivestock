import { NotificationsView } from "@/app/components/notifications-view";

export const metadata = {
  title: "Notifications | Municipal Slaughterhouse",
  description: "Ante-mortem inspections, slaughter records, and clearance notices",
};

export default function SlaughterhouseNotificationsPage() {
  return (
    <main className="flex-1 min-w-0 pb-12">
      <NotificationsView
        variant="slaughterhouse"
        title="Notifications"
        subtitle="Slaughterhouse requests, inspection notices, and meat clearance logs."
      />
    </main>
  );
}
