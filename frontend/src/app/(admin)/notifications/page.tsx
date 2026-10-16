import { NotificationsView } from "@/app/components/notifications-view";

export const metadata = {
  title: "Notifications | Padre Garcia Agriculture Office",
  description: "View and manage system and administrative notifications",
};

export default function AdminNotificationsPage() {
  return (
    <main className="flex-1 min-w-0 pb-12">
      <NotificationsView
        variant="admin"
        title="Notifications"
        subtitle="Official Municipal Agriculture Office (MAO) notices, validation queues, and alerts."
      />
    </main>
  );
}
