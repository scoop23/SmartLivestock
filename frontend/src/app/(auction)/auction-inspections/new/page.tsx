import NewMovementLogRoute from "./new-movement-log-route";

export default async function NewMovementLogPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  return <NewMovementLogRoute editId={edit || null} />;
}
