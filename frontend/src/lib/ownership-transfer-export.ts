/** Canonical ownership-transfer upload columns shared by Auction and MAO. */
export const ownershipTransferHeaders = [
  "transfer_certificate_number", "external_seller_name", "external_owner_name",
  "external_livestock_type", "transfer_date", "municipality", "province", "tag_number",
  "external_livestock_tag_number", "origin_municipality", "origin_province", "purchase_price",
  "sex_at_transfer", "age_at_transfer", "breed_at_transfer", "weight_at_transfer_kg",
];

interface TransferExportRecord {
  livestock: number | null;
  transfer_certificate_number: string;
  previous_owner_name: string;
  new_owner_name: string;
  livestock_type_name: string;
  livestock_tag: string;
  transfer_date: string;
  municipality: string;
  province: string;
  origin_municipality?: string;
  origin_province?: string;
  purchase_price: string | null;
  sex_at_transfer?: string;
  age_at_transfer?: string;
  breed_at_transfer?: string;
  weight_at_transfer_kg?: string | null;
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function ownershipTransferCsv(records: TransferExportRecord[]): string {
  const rows = records.map(record => [
    record.transfer_certificate_number, record.previous_owner_name, record.new_owner_name,
    record.livestock_type_name, record.transfer_date, record.municipality, record.province,
    record.livestock ? record.livestock_tag : "", record.livestock ? "" : record.livestock_tag,
    record.origin_municipality, record.origin_province, record.purchase_price,
    record.sex_at_transfer, record.age_at_transfer, record.breed_at_transfer, record.weight_at_transfer_kg,
  ]);
  return "\ufeff" + [ownershipTransferHeaders, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}
