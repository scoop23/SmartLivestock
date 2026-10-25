"use client";

import { OfficialReportsWorkspace } from "@/app/(admin)/reports/official-reports-workspace";

export function SibatReportsWorkspace({
  reportingScope,
  isAllBarangays,
}: {
  reportingScope: string;
  isAllBarangays: boolean;
}) {
  return (
    <OfficialReportsWorkspace
      variant="sibat"
      reportingScope={reportingScope}
      isAllBarangays={isAllBarangays}
    />
  );
}
