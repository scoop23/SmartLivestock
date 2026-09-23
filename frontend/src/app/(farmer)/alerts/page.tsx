import { redirect } from "next/navigation";

/**
 * Alerts & Notices page has been decommissioned in favor of the
 * universal Notification Bell popover in the PageHeader component.
 */
export default function AlertsPage() {
  redirect("/farmer");
}
