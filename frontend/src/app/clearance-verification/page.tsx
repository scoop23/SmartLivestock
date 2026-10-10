import ClearanceVerification from "./verification";

export default async function ClearanceVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ control_number?: string | string[] }>;
}) {
  const params = await searchParams;
  const controlNumber = Array.isArray(params.control_number) ? params.control_number[0] : params.control_number;
  return <ClearanceVerification controlNumber={controlNumber ?? ""} />;
}
