import { NotificationsView } from "@/app/components/notifications-view";

export const metadata = {
  title: "Notifications | SIBAT Officer Portal",
  description: "Field verification, declaration reviews, and alert notifications",
};

export default function SibatNotificationsPage() {
  return (
    <main className="flex-1 min-w-0 pb-12">
      <NotificationsView
        variant="sibat"
        title="Notifications"
        subtitle="Field inspection requests, barangay submissions, and animal health notifications."
      />
    </main>
  );
}
