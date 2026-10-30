export function normalizeLivestockTagPrefix(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function nextSequentialLivestockTag(prefix: string, usedTags: string[]): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}-(\\d{3,})$`, "i");
  const highest = usedTags.reduce((max, tag) => {
    const match = tag.trim().match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}
