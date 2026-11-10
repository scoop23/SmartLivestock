"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/app/components/page-header";
import { MeatIcon } from "./icons";
import { SlaughterRecordsView, type BackendSlaughterRecord } from "./slaughter-records-view";
import { DailySlaughterhousePdfDialog } from "../../(slaughterhouse)/components/daily-slaughterhouse-pdf-dialog";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { MOCK_DAILY_RECORDS } from "./mock-data";
import type { SlaughterRecordData } from "../../(slaughterhouse)/components/slaughter-descriptive-analytics";

export default function SlaughterRecordReviewPage() {
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("2026-08");

  // Fetch real backend records
  const recordsQuery = useQuery({
    queryKey: ["slaughterhouse-review-records"],
    queryFn: async () => (await api.get<BackendSlaughterRecord[]>("/production/slaughterhouse/records/")).data,
  });

  const backendRecords = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);

  // Parse current month and year numbers for PDF dialog initialization
  const initialMonthNum = useMemo(() => {
    if (!selectedMonth || selectedMonth === "ALL") return 7; // August is index 7
    const parts = selectedMonth.split("-");
    return parts.length > 1 ? parseInt(parts[1], 10) - 1 : 7;
  }, [selectedMonth]);

  const initialYearNum = useMemo(() => {
    if (!selectedMonth || selectedMonth === "ALL") return 2026;
    const parts = selectedMonth.split("-");
    return parts.length > 0 ? parseInt(parts[0], 10) : 2026;
  }, [selectedMonth]);

  // Transform records into SlaughterRecordData format for the PDF dialog
  const pdfRecords: SlaughterRecordData[] = useMemo(() => {
    if (backendRecords.length > 0) {
      return backendRecords.map((r) => ({
        id: r.id,
        livestock_type: r.livestock_type,
        livestock_type_name: r.livestock_type_name,
        quantity: r.quantity,
        carcass_weight: r.carcass_weight,
        record_date: r.record_date,
        barangay: r.barangay,
        status: r.status,
        review_remarks: r.review_remarks,
        created_by_name: r.created_by_name,
        can_edit: r.can_edit,
        condemned_heads: r.condemned_heads,
        condemned_weight_kg: r.condemned_weight_kg,
        condemnation_reason: r.condemnation_reason,
        condemnation_type: r.condemnation_type,
      }));
    }

    // Fallback list from mock records
    const list: SlaughterRecordData[] = [];
    let counter = 1;
    MOCK_DAILY_RECORDS.forEach((d) => {
      if (d.carabao.heads > 0) {
        list.push({
          id: counter++,
          livestock_type: 4,
          livestock_type_name: "Carabao",
          quantity: d.carabao.heads,
          carcass_weight: String(d.carabao.kg),
          record_date: d.isoDate,
          barangay: 1,
          status: d.status,
          review_remarks: d.remarks || "",
          created_by_name: d.farmer,
          can_edit: false,
        });
      }
      if (d.cattle.heads > 0) {
        list.push({
          id: counter++,
          livestock_type: 1,
          livestock_type_name: "Cattle",
          quantity: d.cattle.heads,
          carcass_weight: String(d.cattle.kg),
          record_date: d.isoDate,
          barangay: 1,
          status: d.status,
          review_remarks: d.remarks || "",
          created_by_name: d.farmer,
          can_edit: false,
        });
      }
      if (d.hogs.heads > 0) {
        list.push({
          id: counter++,
          livestock_type: 2,
          livestock_type_name: "Swine",
          quantity: d.hogs.heads,
          carcass_weight: String(d.hogs.kg),
          record_date: d.isoDate,
          barangay: 1,
          status: d.status,
          review_remarks: d.remarks || "",
          created_by_name: d.farmer,
          can_edit: false,
        });
      }
    });
    return list;
  }, [backendRecords]);

  return (
    <>
      <PageHeader
        title="Slaughter Records"
        subtitle="View official slaughterhouse records submitted directly by abattoir staff to MAO."
        variant="admin"
        icon={<MeatIcon className="size-6 text-[#1E7E34]" />}
        maxWidthClass="w-full"
        breadcrumbs={[
          { label: "Slaughterhouse", href: "/slaughter-record-review" },
          { label: "Slaughter Records", href: "/slaughter-record-review" },
        ]}
      />
      <div className="w-full flex-1 min-h-[calc(100vh-4.5rem)] nexus-ambient-bg p-4 sm:p-6 lg:p-8">
        <SlaughterRecordsView
          selectedMonth={selectedMonth}
          onSelectedMonthChange={setSelectedMonth}
          onOpenPdfReport={() => setPdfDialogOpen(true)}
        />
      </div>

      {/* Official Monthly Report Printable PDF Dialog */}
      <DailySlaughterhousePdfDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        records={pdfRecords}
        loading={recordsQuery.isLoading}
        initialMonth={initialMonthNum}
        initialYear={initialYearNum}
      />
    </>
  );
}
