"use client";

import { useAuth } from "@/contexts/auth-context";
import { SibatReportsWorkspace } from "./sibat-reports-workspace";

export default function SibatBarangayReportsPage() {
  const { user } = useAuth();

  return (
    <SibatReportsWorkspace assignedBarangay={user?.assignedBarangayName ?? ""} />
  );
}
