/** A QR carries only the inventory primary key; the API resolves it under RBAC. */
export function livestockIdentityQrPayload(inventoryId: number | string): string {
  const id = String(inventoryId).trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("A numeric livestock inventory ID is required for its QR payload.");
  }
  return `SL-LIVESTOCK:${id}`;
}
