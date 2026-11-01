"use client";

import { ActivitiesEditor } from "@/app/components/community/activities-editor";
import { useAuth } from "@/contexts/auth-context";

export default function Page() {
  const { user } = useAuth();
  const isCbat = user?.role?.toUpperCase() === "CBAT";
  return <ActivitiesEditor role={isCbat ? "cbat" : "sibat"} />;
}
