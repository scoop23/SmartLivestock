"use client";

import { useAuth } from "@/contexts/auth-context";
import { SibatReportsWorkspace } from "./sibat-reports-workspace";

export default function SibatBarangayReportsPage() {
  const { user } = useAuth();
  const isAllBarangays = user?.accessScope === "ALL_BARANGAYS";
  const reportingScope = isAllBarangays
    ? "All Barangays"
    : user?.assignedBarangayName ?? "";

  return (
    <SibatReportsWorkspace reportingScope={reportingScope} isAllBarangays={isAllBarangays} />
  );
}
