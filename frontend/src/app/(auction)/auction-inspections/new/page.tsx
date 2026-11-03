import { PageHeader } from "@/app/components/page-header";
import { ClipboardCheck } from "lucide-react";
import NewMovementLogRoute from "./new-movement-log-route";

export default async function NewMovementLogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  return (
    <>
      <PageHeader
        title={edit ? "Correct Movement Log" : "New Movement Log"}
        subtitle="Record livestock movement for MAO review."
        icon={<ClipboardCheck className="size-5" />}
        variant="auction"
        maxWidthClass="w-full"
      />
      <NewMovementLogRoute editId={edit || null} />
    </>
  );
}
