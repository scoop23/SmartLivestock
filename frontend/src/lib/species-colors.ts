/**
 * Canonical Livestock Species Color System for SmartLivestock.
 *
 * Source of truth:
 * - Admin municipal analytics (`admin-charts.ts` SPECIE_COLOR_PALETTE)
 * - Aligned with Padre Garcia Municipal Agriculture brand identity:
 *   - Cattle: Forest Green (#2D5A27) - Cattle Capital of the Philippines
 *   - Swine: Amber Orange (#F59E0B)
 *   - Carabao: Cobalt Sky Blue (#0284C7)
 *   - Goat: Purple Violet (#8B5CF6)
 *   - Sheep: Medium Purple (#A855F7)
 *   - Poultry: Rose Pink (#EC4899)
 *   - Other / Neutral Fallback: Slate Gray (#64748B)
 */

export const SPECIE_COLOR_PALETTE: Record<string, string> = {
  Cattle: "#2D5A27",
  Swine: "#F59E0B",
  Carabao: "#0284C7",
  Goat: "#8B5CF6",
  Sheep: "#A855F7",
  Poultry: "#EC4899",
  Other: "#64748B",
};

export type KnownSpeciesCategory =
  | "cattle"
  | "swine"
  | "carabao"
  | "goat"
  | "sheep"
  | "poultry"
  | "other";

/**
 * Normalizes any backend species name or string to a standard category key.
 * Handles English, Tagalog (Baka, Baboy, Kalabaw, Kambing, Tupa, Manok), and biological terms.
 */
export function normalizeSpeciesCategory(rawName?: string | null): KnownSpeciesCategory {
  const name = (rawName || "").toLowerCase().trim();
  if (
    name.includes("swine") ||
    name.includes("pig") ||
    name.includes("baboy") ||
    name.includes("hog") ||
    name.includes("porcine")
  ) {
    return "swine";
  }
  if (name.includes("carabao") || name.includes("buffalo") || name.includes("kalabaw")) {
    return "carabao";
  }
  if (name.includes("sheep") || name.includes("tupa")) {
    return "sheep";
  }
  if (name.includes("goat") || name.includes("kambing") || name.includes("caprine")) {
    return "goat";
  }
  if (
    name.includes("poultry") ||
    name.includes("chicken") ||
    name.includes("manok") ||
    name.includes("duck") ||
    name.includes("itik") ||
    name.includes("pato") ||
    name.includes("avian") ||
    name.includes("egg")
  ) {
    return "poultry";
  }
  if (
    name.includes("cattle") ||
    name.includes("baka") ||
    name.includes("bovine") ||
    name.includes("bull") ||
    name.includes("heifer") ||
    name.includes("cow") ||
    name.includes("calf")
  ) {
    return "cattle";
  }
  return "other";
}

/**
 * Returns the canonical hex color for a given species name.
 * Tied directly to the species identity, not dataset index or sorting order.
 * Unknown or unmapped species receive a safe neutral slate fallback.
 */
export function getSpeciesColor(rawName?: string | null): string {
  const category = normalizeSpeciesCategory(rawName);
  switch (category) {
    case "cattle":
      return SPECIE_COLOR_PALETTE.Cattle;
    case "swine":
      return SPECIE_COLOR_PALETTE.Swine;
    case "carabao":
      return SPECIE_COLOR_PALETTE.Carabao;
    case "goat":
      return SPECIE_COLOR_PALETTE.Goat;
    case "sheep":
      return SPECIE_COLOR_PALETTE.Sheep;
    case "poultry":
      return SPECIE_COLOR_PALETTE.Poultry;
    case "other":
    default:
      return SPECIE_COLOR_PALETTE.Other;
  }
}
