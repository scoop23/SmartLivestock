"use client";

import { OfficialReportsWorkspace } from "./official-reports-workspace";

export function ReportsWorkspace({
  variant = "admin",
  fixedBarangay,
}: {
  variant?: "admin" | "sibat";
  fixedBarangay?: string;
}) {
  return (
    <OfficialReportsWorkspace
      variant={variant}
      reportingScope={fixedBarangay}
      isAllBarangays={variant === "admin" && !fixedBarangay}
    />
  );
}
