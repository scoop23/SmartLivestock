/** A QR carries only the inventory primary key; the API resolves it under RBAC. */
export function livestockIdentityQrPayload(inventoryId: number | string): string {
  const id = String(inventoryId).trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("A numeric livestock inventory ID is required for its QR payload.");
  }
  return `SL-LIVESTOCK:${id}`;
}

/** A herd has its own identity and must never resolve as an individual animal. */
export function livestockBatchQrPayload(batchId: number | string): string {
  const id = String(batchId).trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("A numeric livestock batch ID is required for its QR payload.");
  }
  return `SL-BATCH:${id}`;
}

export type LivestockQrTarget =
  | { kind: "INDIVIDUAL"; code: string }
  | { kind: "BATCH"; code: string }
  | { kind: "UNSUPPORTED"; code: string };

/** Parse current QR payloads and the batch URL format used by older passes. */
export function parseLivestockQrPayload(value: string): LivestockQrTarget {
  const input = value.trim();
  const livestockId = input.match(/^SL-LIVESTOCK:(.+)$/i);
  if (livestockId) return { kind: "INDIVIDUAL", code: `SL-LIVESTOCK:${livestockId[1].trim()}` };

  const batchId = input.match(/^SL-BATCH:(.+)$/i);
  if (batchId) return { kind: "BATCH", code: `SL-BATCH:${batchId[1].trim()}` };

  if (/^SL-(?:FARMER|PERMIT|PROFILE):/i.test(input)) {
    return { kind: "UNSUPPORTED", code: input };
  }

  try {
    const parsedUrl = new URL(input);
    const batch = parsedUrl.searchParams.get("batchId");
    if (batch) {
      // Older farmer profile passes reused the batch query parameter with an RSBSA code.
      // Keep those legacy payloads from being mistaken for a herd identifier.
      if (/^RSBSA-/i.test(batch.trim())) return { kind: "UNSUPPORTED", code: batch.trim() };
      return { kind: "BATCH", code: batch.trim() };
    }
    const inventoryId = parsedUrl.searchParams.get("livestockId");
    if (inventoryId) return { kind: "INDIVIDUAL", code: `SL-LIVESTOCK:${inventoryId.trim()}` };
    const tag = parsedUrl.searchParams.get("tag");
    if (tag) return { kind: "INDIVIDUAL", code: tag.trim() };
    const inventoryPath = parsedUrl.pathname.match(/\/livestock-inventory\/(\d+)(?:\/|$)/i);
    if (inventoryPath) return { kind: "INDIVIDUAL", code: `SL-LIVESTOCK:${inventoryPath[1]}` };
  } catch {
    // A manual ear tag is commonly plain text rather than a URL.
  }

  return { kind: "INDIVIDUAL", code: input };
}
